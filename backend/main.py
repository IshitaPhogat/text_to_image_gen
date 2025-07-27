from operator import truediv

from dotenv import load_dotenv
import os

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator

import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

import base64
import io
from PIL import Image
from typing import Optional
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Text-to-Image Generator", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000","http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----VERTEX AI---------
# Get Project ID and Region from environment variables or use defaults
# Make sure GCP_PROJECT_ID matches your project from `gcloud init` (e.g., 'text-to-image-gen')
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "text-to-image-gen")
REGION = os.getenv("GCP_REGION", "us-central1")

# Initialize Vertex AI
try:
    vertexai.init(project=PROJECT_ID, location=REGION)
    logger.info(f"Vertex AI initialized for project {PROJECT_ID} in region {REGION}")
except Exception as e:
    logger.error(f"Failed to initialize Vertex AI: {e}", exc_info=True)
    raise ValueError(f"Failed to initialize Vertex AI: {e}. "
                     "Ensure Vertex AI API is enabled for your project "
                     "and `gcloud auth application-default login` is run.")

# Define supported aspect ratios centrally
SUPPORTED_ASPECT_RATIOS = ["1:1", "9:16", "16:9", "4:3", "3:4"]


class ImageGenerationRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = None
    aspect_ratio: str = Field("1:1",
                              description=f"Desired aspect ratio for the image. Supported: {', '.join(SUPPORTED_ASPECT_RATIOS)}")
    person_generation: Optional[str] = "dont_allow"

    @validator('aspect_ratio')
    def validate_aspect_ratio(cls, v):
        if v not in SUPPORTED_ASPECT_RATIOS:
            raise ValueError(
                f"Unsupported aspect ratio: '{v}'. Supported options are: {', '.join(SUPPORTED_ASPECT_RATIOS)}")
        return v


class ImageGenerationResponse(BaseModel):
    success: bool
    image_data: Optional[str] = None
    error: Optional[str] = None
    generation_time: Optional[float] = None


# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=4)


def generate_image_sync(prompt: str, negative_prompt: Optional[str] = None,
                        aspect_ratio: str = "1:1", person_generation: str = "dont_allow") -> dict:
    """Synchronous image generation function using google vertex ai imagen"""
    try:
        import time
        start_time = time.time()

        # Initialize the Imagen model
        model = ImageGenerationModel.from_pretrained("imagen-3.0-fast-generate-001")

        imagen_parameters = {
            "negative_prompt": negative_prompt,
            "aspect_ratio": aspect_ratio,
        }

        # modify prompt on no of people selected
        full_prompt = prompt
        if person_generation == "dont_allow":
            full_prompt += " | No people, no human figures, no faces"
        elif person_generation == "allow_adult":
            full_prompt += " | Adults only, no minors"

        # Add negative prompt if provided
        if negative_prompt:
            full_prompt += f" | Negative prompt: {negative_prompt}"

        logger.info(f"Generating image with prompt: '{full_prompt}' using Vertex AI Imagen.")

        # Generate image
        images = model.generate_images(
            prompt=full_prompt,
            number_of_images=1,
            **imagen_parameters
        )

        if not images.images:
            return {'success': False, 'error': 'No image returned from Imagen API. Check prompt or safety settings.'}

        # extract image data from first canditate and the attrivute is typically _image_bytes attribute
        image_data_bytes = images.images[0]._image_bytes

        if image_data_bytes:
            image_base64 = base64.b64encode(image_data_bytes).decode('utf-8')
            generation_time = time.time() - start_time
            return {
                'success': True,
                'image_data': image_base64,
                'generation_time': generation_time
            }
        return {'success': False, 'error': 'No valid image data found in Imagen response candidate.'}

    except Exception as e:
        logger.error(f"Error generating image: {str(e)}", exc_info=True)
        return {'success': False, 'error': f"Internal server error during image generation: {str(e)}"}


@app.get("/")
async def root():
    return {"message": "Text-to-Image Generator API", "status": "running"}


@app.get("/health")
async def health_check():
    try:
        _ = vertexai.preview.vision_models.ImageGenerationModel.from_pretrained("imagen-3.0-fast-generate-001")
        return {
            "status": "healthy",
            "api_configured": True,  # Indicates Vertex AI is configured
            "vertex_ai_accessible": True
        }
    except Exception as e:
        logger.error(f"Vertex AI health check failed: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "api_configured": False,
            "vertex_ai_accessible": False,
            "error": str(e)
        }


@app.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_image(request: ImageGenerationRequest):
    """Generate an image from text prompt using Google Imagen"""

    if not request.prompt or len(request.prompt.strip()) == 0:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    if len(request.prompt) > 1000:
        raise HTTPException(status_code=400, detail="Prompt too long (max 1000 characters)")

    try:
        # Run the blocking operation in a thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            generate_image_sync,
            request.prompt,
            request.negative_prompt,
            request.aspect_ratio,
            request.person_generation
        )

        if result['success']:
            return ImageGenerationResponse(
                success=True,
                image_data=result['image_data'],
                generation_time=result.get('generation_time')
            )
        else:
            raise HTTPException(status_code=500, detail=result['error'])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in /generate-image endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/models")
async def get_available_models():
    """Get information about available models"""
    return {
        "models": [
            {
                "name": "imagen-3.0-generate-001",
                "description": "Google's Imagen 3.0 model for text-to-image generation",
                "supported_aspect_ratios": SUPPORTED_ASPECT_RATIOS,
                "max_prompt_length": 1000
            }
        ]
    }

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)