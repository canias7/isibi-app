import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Play, Loader2 } from "lucide-react";

const API_URL = 'https://your-backend.onrender.com/api';

export default function VoiceProviderSelector({ value, onChange, token }) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(value?.provider || 'openai');
  const [selectedVoice, setSelectedVoice] = useState(value?.voice_id || 'alloy');
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadVoiceProviders();
  }, []);

  useEffect(() => {
    // Notify parent of changes
    if (onChange) {
      onChange({
        provider: selectedProvider,
        voice_id: selectedVoice
      });
    }
  }, [selectedProvider, selectedVoice]);

  const loadVoiceProviders = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/voices/providers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
      }
    } catch (error) {
      console.error('Failed to load voice providers:', error);
      toast({
        title: "Error",
        description: "Failed to load voice providers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testVoice = async (provider, voiceId) => {
    setTesting(voiceId);
    
    try {
      const res = await fetch(
        `${API_URL}/voices/test/${provider}/${voiceId}?text=Hello! This is a test of this voice.`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (res.ok) {
        if (provider === 'elevenlabs') {
          // Download and play audio
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play();
          
          audio.onended = () => {
            URL.revokeObjectURL(url);
          };
          
          toast({
            title: "Voice Test",
            description: "Playing voice sample..."
          });
        } else {
          const data = await res.json();
          toast({
            title: "Voice Available",
            description: data.message
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test voice",
        variant: "destructive"
      });
    } finally {
      setTesting(null);
    }
  };

  const currentProvider = providers.find(p => p.id === selectedProvider);
  const availableVoices = currentProvider?.voices || [];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Voice Selection</CardTitle>
          <CardDescription>Loading voice providers...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Selection</CardTitle>
        <CardDescription>Choose a voice provider and voice for your AI agent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div>
          <Label className="text-base font-semibold mb-3 block">Voice Provider</Label>
          <RadioGroup value={selectedProvider} onValueChange={setSelectedProvider}>
            {providers.map((provider) => (
              <div
                key={provider.id}
                className={`flex items-center space-x-2 p-4 rounded-lg border-2 transition-colors ${
                  selectedProvider === provider.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                } ${!provider.enabled ? 'opacity-50' : ''}`}
              >
                <RadioGroupItem value={provider.id} id={provider.id} disabled={!provider.enabled} />
                <Label
                  htmlFor={provider.id}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{provider.name}</div>
                      <div className="text-sm text-muted-foreground">{provider.description}</div>
                    </div>
                    {!provider.enabled && (
                      <Badge variant="outline">Not Configured</Badge>
                    )}
                    {provider.enabled && (
                      <Badge variant="secondary">{provider.voices.length} voices</Badge>
                    )}
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Voice Selection */}
        {currentProvider?.enabled && (
          <div>
            <Label className="text-base font-semibold mb-3 block">Select Voice</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {availableVoices.map((voice) => (
                <div
                  key={voice.id || voice.voice_id}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedVoice === (voice.id || voice.voice_id)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedVoice(voice.id || voice.voice_id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-semibold">{voice.name}</div>
                      {voice.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {voice.description}
                        </div>
                      )}
                    </div>
                    {selectedVoice === (voice.id || voice.voice_id) && (
                      <Badge variant="default" className="ml-2">Selected</Badge>
                    )}
                  </div>
                  
                  {voice.category && (
                    <Badge variant="outline" className="text-xs mb-2">
                      {voice.category}
                    </Badge>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      testVoice(selectedProvider, voice.id || voice.voice_id);
                    }}
                    disabled={testing === (voice.id || voice.voice_id)}
                  >
                    {testing === (voice.id || voice.voice_id) ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 mr-1" />
                        Test Voice
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Selection Summary */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="text-sm font-semibold mb-1">Current Selection:</div>
          <div className="text-sm">
            <strong>Provider:</strong> {currentProvider?.name || 'None'}
          </div>
          <div className="text-sm">
            <strong>Voice:</strong>{' '}
            {availableVoices.find(v => (v.id || v.voice_id) === selectedVoice)?.name || selectedVoice}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
