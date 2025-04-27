'use client';

import type { MediaPost } from '@/services/subreddit-scraper'; // Use MediaPost
import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { scrapeSubredditAction } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertCircle, Image as ImageIconLucide, Film, Video } from 'lucide-react'; // Keep icons
import MediaGrid from '@/components/media-grid'; // Ensure correct import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast";

interface ScrapeState {
  media: MediaPost[] | null; // Changed from images to media
  error: string | null;
  message: string | null;
  timestamp: number;
}

const initialState: ScrapeState = {
  media: null, // Initial state uses media
  error: null,
  message: null,
  timestamp: Date.now(),
};

// Limit options
const limitOptions = [10, 25, 50, 100];
const defaultLimit = 25;

// Submit Button Component using useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full sm:w-auto mt-4 sm:mt-0 sm:ml-4"
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Fetching...</span>
        </>
      ) : (
        <span>Get Images</span> // Updated button text
      )}
    </Button>
  );
}


export default function Home() {
  const [state, formAction] = useActionState(scrapeSubredditAction, initialState);
  const [showInitialMessage, setShowInitialMessage] = React.useState(true);
  const formRef = React.useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  // Effect to show toast notification on success
  React.useEffect(() => {
    if (state.message && !state.error && state.timestamp !== initialState.timestamp) { // Check timestamp to avoid initial toast
      toast({
        title: "Success",
        description: state.message,
        duration: 3000, // Increased duration slightly
      });
    }
  }, [state.message, state.error, state.timestamp, toast]); // Dependency includes timestamp


  React.useEffect(() => {
    // Hide initial message once an action completes (success or error)
    if (state.timestamp !== initialState.timestamp && (state.media !== null || state.error !== null)) {
       setShowInitialMessage(false);
    }
  }, [state.timestamp, state.media, state.error]); // Dependencies use media

  // Effect to add the Adsterra popunder script
  React.useEffect(() => {
    const scriptId = 'adsterra-popunder-script';

    // Prevent adding the script multiple times
    if (document.getElementById(scriptId)) {
      console.log("Adsterra popunder script already loaded.");
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'text/javascript';
    // IMPORTANT: Ensure the protocol is included (e.g., https:)
    script.src = '//pl26497243.profitableratecpm.com/3f/b6/10/3fb6107bbce8ecab2b3f67c538353c74.js';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load the Adsterra popunder script.');
    };
    script.onload = () => {
        console.log("Adsterra popunder script loaded successfully.");
    };

    document.body.appendChild(script);

    // Cleanup function to remove the script if the component unmounts
    // This might not be desired for ad scripts that should persist.
    // return () => {
    //   const existingScript = document.getElementById(scriptId);
    //   if (existingScript) {
    //     document.body.removeChild(existingScript);
    //     console.log("Adsterra popunder script removed on component unmount.");
    //   }
    // };
  }, []); // Empty dependency array ensures this runs only once on mount


  return (
     <main className="container mx-auto flex min-h-screen flex-col items-center p-4 sm:p-8">
       {/* Central Content Area */}
       <div className="flex flex-col items-center w-full max-w-3xl">
         <Card className="w-full shadow-lg mb-8 rounded-lg">
           <CardHeader className="p-4 sm:p-6">
             <CardTitle className="text-xl sm:text-2xl font-bold text-center text-foreground">Reddit Meme Scrapper</CardTitle> {/* Updated Title */}
           </CardHeader>
           <CardContent className="p-4 sm:p-6">
             <form ref={formRef} action={formAction} className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-end sm:space-x-4 space-y-4 sm:space-y-0">
                   {/* Subreddit URL Input */}
                   <div className="flex-grow space-y-2">
                     <Label htmlFor="subredditUrl" className="text-sm font-medium">Subreddit URL</Label>
                     <Input
                       id="subredditUrl"
                       name="subredditUrl"
                       type="url"
                       placeholder="e.g., https://www.reddit.com/r/pics/"
                       required
                       className="bg-input text-foreground placeholder:text-muted-foreground rounded-md text-base"
                     />
                   </div>

                    {/* Limit Dropdown */}
                    <div className="space-y-2 sm:w-auto w-full">
                       <Label htmlFor="limit" className="text-sm font-medium">Max Items</Label> {/* Updated Label */}
                       <Select name="limit" defaultValue={defaultLimit.toString()}>
                         <SelectTrigger id="limit" className="w-full sm:w-[120px] bg-input text-foreground rounded-md">
                           <SelectValue placeholder="Select limit" />
                         </SelectTrigger>
                         <SelectContent>
                           {limitOptions.map(option => (
                             <SelectItem key={option} value={option.toString()}>
                               {option}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                    </div>

                   {/* Submit Button Component */}
                   <SubmitButton />
               </div>
             </form>
           </CardContent>
         </Card>

         {/* Results Area - Increased width */}
         <div className="w-full max-w-7xl"> {/* Changed from max-w-6xl to max-w-7xl */}
           {/* Error Display */}
           {state.error && (
              <Alert variant="destructive" className="mb-6 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                {state.error.includes("credentials") || state.error.includes("401") ? (
                   <AlertDescription>
                       {state.error.includes("credentials")
                           ? "Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET) are not configured correctly on the server."
                           : "Failed to authenticate with Reddit API (401 Unauthorized)."}
                       {' '} Please check your credentials in the{' '}
                       <code className="font-mono text-xs bg-muted p-1 rounded">.env</code> file. You need to create a Reddit application{' '}
                       <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="underline hover:text-destructive-foreground">
                           here
                       </a> (choose 'script' type) and ensure both <code className="font-mono text-xs bg-muted p-1 rounded">REDDIT_CLIENT_ID</code> and <code className="font-mono text-xs bg-muted p-1 rounded">REDDIT_CLIENT_SECRET</code> are set correctly.
                   </AlertDescription>
                ) : state.error.includes("403") ? (
                     <AlertDescription>
                         Access denied by Reddit API (403 Forbidden). This could be due to invalid API key permissions, a blocked User-Agent, IP restrictions, or subreddit rules. Please check your setup and Reddit's API terms. Details: {state.error}
                     </AlertDescription>
                ) : state.error.includes("404") ? (
                    <AlertDescription>
                        Subreddit not found or private (404). Please verify the subreddit URL. Details: {state.error}
                    </AlertDescription>
                ): (
                   <AlertDescription>{state.error}</AlertDescription> // Default error display
                )}
              </Alert>
           )}

           {/* Initial Message */}
           {showInitialMessage && !state.media && !state.error && (
             <div className="text-center text-muted-foreground mt-10 p-6 border border-dashed rounded-lg">
               <ImageIconLucide className="mx-auto h-12 w-12 mb-4 text-muted-foreground/70" />
               <p>Enter a subreddit URL, select the number of items, and click "Get Images" to see results.</p> {/* Updated text */}
             </div>
           )}

            {/* "No Media Found" Message - Adjusted check and text */}
            {!showInitialMessage && state.media?.length === 0 && !state.error && (
              <Alert className="mb-6 rounded-md border-accent">
                <AlertCircle className="h-4 w-4 text-accent" />
                <AlertTitle>No Suitable Images Found</AlertTitle> {/* Updated Title */}
                <AlertDescription>{state.message || "The Reddit API returned posts, but none contained direct image links matching the criteria (e.g., not videos, gifs, galleries, or filtered by allowed domains)."}</AlertDescription> {/* Updated Description */}
              </Alert>
           )}

           {/* Display Media Grid - Check if media array exists and has items */}
           {state.media && state.media.length > 0 && (
              <>
                {/* Pass state.media to the grid */}
                <MediaGrid key={state.timestamp} media={state.media} />
              </>
           )}
         </div>
       </div>
     </main>
  );
}
