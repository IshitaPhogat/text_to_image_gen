import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, Image, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';


interface GenerationResponse {
    success: boolean;
    image_data?: string;
    error?: string;
    generation_time?: number;
}

const API_BASE_URL = 'http://localhost:8000';

export default function TextToImageGenerator() {
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [personGeneration, setPersonGeneration] = useState('dont_allow');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generationTime, setGenerationTime] = useState<number | null>(null);
    const [apiHealth, setApiHealth] = useState<boolean | null>(null);

    const imageRef = useRef<HTMLImageElement>(null);

    // Check API health on component mount
    React.useEffect(() => {
        checkApiHealth();
    }, []);

    const checkApiHealth = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
            const data = await response.json();
            setApiHealth(data.status === 'healthy' && data.api_configured);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            setApiHealth(false);
        }
    };

    const generateImage = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt');
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedImage(null);
        setGenerationTime(null);

        try {
            const response = await fetch(`${API_BASE_URL}/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    negative_prompt: negativePrompt.trim() || null,
                    aspect_ratio: aspectRatio,
                    person_generation: personGeneration,
                }),
            });

            const data: GenerationResponse = await response.json();

            if (data.success && data.image_data) {
                setGeneratedImage(`data:image/png;base64,${data.image_data}`);
                setGenerationTime(data.generation_time || null);
            } else {
                setError(data.error || 'Failed to generate image');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect to API');
        } finally {
            setIsGenerating(false);
        }
    };

    const downloadImage = () => {
        if (!generatedImage) return;

        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `generated-image-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const aspectRatios = [
        { value: '1:1', label: 'Square (1:1)' },
        { value: '9:16', label: 'Portrait (9:16)' },
        { value: '16:9', label: 'Landscape (16:9)' },
        { value: '4:3', label: 'Standard (4:3)' },
        { value: '3:4', label: 'Portrait (3:4)' },
    ];

    const personGenerationOptions = [
        { value: 'dont_allow', label: 'No People' },
        { value: 'allow_adult', label: 'Allow Adults' },
        { value: 'allow_minor', label: 'Allow All Ages' },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <Sparkles className="h-8 w-8 text-blue-600" />
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            AI Image Generator
                        </h1>
                    </div>
                    <p className="text-lg text-slate-600 dark:text-slate-300">
                        Transform your ideas into stunning images with Google's Imagen AI
                    </p>

                    {/* API Status */}
                    <div className="flex justify-center mt-4">
                        {apiHealth === null ? (
                            <Badge variant="secondary">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Checking API...
                            </Badge>
                        ) : apiHealth ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                API Ready
                            </Badge>
                        ) : (
                            <Badge variant="destructive">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                API Unavailable
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Input Panel */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Image className="h-5 w-5" />
                                Generation Settings
                            </CardTitle>
                            <CardDescription>
                                Describe what you want to create and customize the settings
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Prompt */}
                            <div className="space-y-2">
                                <Label htmlFor="prompt" className="text-sm font-medium">
                                    Prompt *
                                </Label>
                                <Textarea
                                    id="prompt"
                                    placeholder="A majestic dragon soaring through a cloudy sky at sunset..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="min-h-[100px] resize-none"
                                    maxLength={1000}
                                />
                                <div className="text-xs text-slate-500 text-right">
                                    {prompt.length}/1000 characters
                                </div>
                            </div>

                            {/* Negative Prompt */}
                            <div className="space-y-2">
                                <Label htmlFor="negative-prompt" className="text-sm font-medium">
                                    Negative Prompt (Optional)
                                </Label>
                                <Textarea
                                    id="negative-prompt"
                                    placeholder="blurry, low quality, distorted..."
                                    value={negativePrompt}
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    className="min-h-[80px] resize-none"
                                    maxLength={500}
                                />
                                <div className="text-xs text-slate-500 text-right">
                                    {negativePrompt.length}/500 characters
                                </div>
                            </div>

                            <Separator />

                            {/* Settings Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Aspect Ratio */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">Aspect Ratio</Label>
                                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {aspectRatios.map((ratio) => (
                                                <SelectItem key={ratio.value} value={ratio.value}>
                                                    {ratio.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Person Generation */}
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium">People in Image</Label>
                                    <Select value={personGeneration} onValueChange={setPersonGeneration}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {personGenerationOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Generate Button */}
                            <Button
                                onClick={generateImage}
                                disabled={!prompt.trim() || isGenerating || !apiHealth}
                                className="w-full h-12 text-lg font-medium"
                                size="lg"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-5 w-5 mr-2" />
                                        Generate Image
                                    </>
                                )}
                            </Button>

                            {/* Error Alert */}
                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Result Panel */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Generated Image</CardTitle>
                            <CardDescription>
                                Your AI-generated image will appear here
                                {generationTime && (
                                    <Badge variant="secondary" className="ml-2">
                                        {generationTime.toFixed(1)}s
                                    </Badge>
                                )}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                                {isGenerating ? (
                                    <div className="text-center space-y-4">
                                        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
                                        <div className="space-y-2">
                                            <p className="text-lg font-medium">Creating your image...</p>
                                            <p className="text-sm text-slate-500">This may take 10-30 seconds</p>
                                        </div>
                                    </div>
                                ) : generatedImage ? (
                                    <div className="relative w-full h-full group">
                                        <img
                                            ref={imageRef}
                                            src={generatedImage}
                                            alt="Generated image"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button
                                                onClick={downloadImage}
                                                className="bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30"
                                            >
                                                <Download className="h-4 w-4 mr-2" />
                                                Download
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4 text-slate-500">
                                        <Image className="h-16 w-16 mx-auto opacity-50" />
                                        <div>
                                            <p className="text-lg font-medium">No image generated yet</p>
                                            <p className="text-sm">Enter a prompt and click generate to start</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {generatedImage && (
                                <div className="mt-4 flex gap-2">
                                    <Button onClick={downloadImage} variant="outline" className="flex-1">
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Image
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setGeneratedImage(null);
                                            setGenerationTime(null);
                                        }}
                                        variant="outline"
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Footer */}
                <div className="text-center mt-12 text-sm text-slate-500">
                    <p>Powered by Google's Imagen AI • Built with React & FastAPI</p>
                </div>
            </div>
        </div>
    );
}