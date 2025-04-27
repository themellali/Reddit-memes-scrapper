
'use client';

import type { MediaPost } from '@/services/subreddit-scraper'; // Ensure correct type import
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card'; // Added CardFooter
import { Button } from '@/components/ui/button'; // Import Button
import { Download, Image as ImageIcon, Video, Film } from 'lucide-react'; // Import necessary icons
import { useToast } from "@/hooks/use-toast"; // Import useToast for feedback

interface MediaGridProps {
  media: MediaPost[]; // Should contain images, videos, redgifs after filtering in action
}

export default function MediaGrid({ media }: MediaGridProps) {
  const { toast } = useToast();

  if (!media || media.length === 0) {
    return null; // Parent handles "no results" message
  }

  const placeholderImageUrl = 'https://picsum.photos/seed/placeholder/400/400'; // Fallback

  const handleDownload = async (url: string, title: string) => {
    if (!url) {
      console.error("Download failed: URL is missing.");
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Media URL is missing.",
        duration: 3000,
      });
      return;
    }
    try {
      console.log(`Attempting to download: ${url}`);
      // Fetch the media data as a blob
      // Use 'no-cors' mode carefully, it might limit what you can do with the response,
      // but is sometimes necessary for cross-origin media without proper CORS headers.
      let response: Response;
      let blob: Blob;

      try {
        // Attempt standard fetch first
        console.log("Attempting standard fetch...");
        response = await fetch(url);
        console.log(`Standard fetch response status: ${response.status}`);

        if (!response.ok) {
          // Throw an error to trigger the catch block for retry logic
          throw new Error(`Initial fetch failed with status: ${response.status}`);
        }

        blob = await response.blob();
        console.log("Successfully obtained blob from standard fetch.");

      } catch (initialFetchError) {
        console.warn(`Initial fetch attempt failed for ${url}:`, initialFetchError);
        console.log("Retrying with mode: 'no-cors'...");

        // NOTE: 'no-cors' fetch results in an OPAQUE response.
        // We can't read status, headers, or body directly.
        // However, response.blob() *might* still work depending on the browser and server.
        const corsResponse = await fetch(url, { mode: 'no-cors' });
        console.log("Opaque 'no-cors' fetch request sent.");

        // We cannot check corsResponse.ok for opaque responses. We proceed and hope blob() works.
        try {
            blob = await corsResponse.blob();
            console.log("Attempted to get blob from opaque response.");
            // Check blob size. Opaque responses might return a 0-sized blob on failure.
            if (!blob || blob.size === 0) {
                 console.error("Failed to get valid blob data from opaque response. Size:", blob?.size);
                 throw new Error("Could not retrieve valid media data using 'no-cors'. The server might be blocking downloads or CORS is strictly enforced.");
            }
            console.log("Successfully obtained blob from opaque response (size > 0).");
        } catch (opaqueBlobError) {
             console.error(`Error getting blob from opaque response for ${url}:`, opaqueBlobError);
             // Throw a more specific error than the original fetch error if opaque blob fails
             // Include the initial error context if available
             const initialMsg = initialFetchError instanceof Error ? `Initial Error: ${initialFetchError.message}. ` : '';
             throw new Error(`${initialMsg}Failed to retrieve media data using 'no-cors' (Opaque Blob Error). Server may be blocking direct download or CORS issue.`);
        }
      }

      // Check if blob is valid (should be okay if initial fetch succeeded or opaque blob() worked)
       if (!blob || blob.size === 0) {
         console.error("Failed to get valid blob data after all attempts.");
         throw new Error("Could not retrieve valid media data.");
       }

      const blobUrl = window.URL.createObjectURL(blob);
      console.log(`Blob URL created: ${blobUrl}`);

      const link = document.createElement('a');
      link.href = blobUrl;
      // Generate a safe filename
      const filename = title.replace(/[^a-z0-9_\-\s]/gi, '_').trim().substring(0, 50) || 'download';
      // Try to get a reasonable extension
      let extension = url.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg'; // Get extension before query params
      const knownExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm']; // Add video if needed
      if (!knownExtensions.includes(extension)) {
          // Try to infer from blob type if possible
          if (blob.type && blob.type.startsWith('image/')) {
              extension = blob.type.split('/')[1] || 'jpg';
          } else if (blob.type && blob.type.startsWith('video/')) {
               extension = blob.type.split('/')[1] || 'mp4';
          } else {
               extension = 'jpg'; // Default fallback
          }
      }
      link.download = `${filename}.${extension}`;
      console.log(`Generated download filename: ${link.download}`);

      document.body.appendChild(link);
      link.click();
      console.log("Download link clicked.");
      document.body.removeChild(link);
      console.log("Download link removed from body.");

      window.URL.revokeObjectURL(blobUrl); // Clean up Blob URL
      console.log("Blob URL revoked.");

      toast({
          title: "Download Started",
          description: `Downloading "${title}".`,
          duration: 3000,
      });

    } catch (error) {
      console.error("Download failed:", error);
      let errorMessage = "Could not download the media.";

       // Check for the specific "Failed to fetch" TypeError, common with CORS/network issues
       if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
          errorMessage = "Network error or cross-origin restrictions prevented download. The media server (e.g., Reddit) might not allow direct downloads from this website (CORS issue).";
       } else if (error instanceof Error) {
          // Use the specific message from other errors, including our custom ones
           errorMessage = error.message;
       }
       toast({
          variant: "destructive",
          title: "Download Failed",
          description: errorMessage,
          duration: 5000, // Longer duration for errors
       });
    }
  };


  return (
      // Adjusted grid columns for 3 per row
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6"> {/* Changed to 3 columns for md and lg */}
        {media.map((item, index) => {
          const mediaUrlToUse = item.mediaUrl || placeholderImageUrl;
          const mediaTitle = item.title || 'Scraped media'; // Keep title for alt text
          const isPlaceholder = mediaUrlToUse === placeholderImageUrl;

          // Basic check - server action should have filtered invalid URLs
          if (!item.mediaUrl) {
            console.warn(`Media post at index ${index} ("${item.title}") has missing URL.`);
             // Render a card indicating missing URL
             return (
               <Card key={`missing-${index}-${item.title}`} className="overflow-hidden shadow-md flex items-center justify-center bg-muted min-h-[300px] rounded-lg"> {/* Consistent min-height */}
                 <p className="text-xs text-muted-foreground p-2 text-center">Media URL missing</p>
               </Card>
             );
          }


          return (
            <Card key={`${index}-${item.mediaUrl}`} className="overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 group rounded-lg flex flex-col">
              {/* Ensure consistent height and contain images/videos */}
              <CardContent className="p-0 relative w-full bg-muted flex items-center justify-center min-h-[300px] overflow-hidden"> {/* Added overflow-hidden */}
                {/* Blurred Background */}
                {item.mediaType === 'image' && ( // Only show blurred background for images
                    <Image
                        src={mediaUrlToUse}
                        alt={`${mediaTitle} background`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }} // Cover to fill the space
                        className="absolute inset-0 w-full h-full filter blur-lg scale-110 opacity-70 pointer-events-none" // Blur, scale slightly, reduce opacity, prevent interaction
                        aria-hidden="true" // Hide from screen readers
                         onError={(e) => {
                            // Don't show error placeholder for background image failure
                             e.currentTarget.style.display = 'none';
                        }}
                         unoptimized={mediaUrlToUse.endsWith('.gif')}
                    />
                )}

                {/* Main Media (Wrapped in link to open in new tab) */}
                 <a
                    href={mediaUrlToUse}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`View "${mediaTitle}" in new tab`} // Tooltip hint
                    className="relative z-10 block w-full h-full min-h-[300px] cursor-pointer" // Make the div fill space and act like a link
                 >
                    {/* Conditional rendering based on mediaType */}
                    {item.mediaType === 'image' && (
                        <Image
                            src={mediaUrlToUse} // Use the direct image URL
                            alt={mediaTitle}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw" // Correct sizes for 3 columns
                            style={{ objectFit: 'contain' }} // Use 'contain' to see the whole image
                            className={`transition-transform duration-300 ease-in-out group-hover:scale-105 ${isPlaceholder ? 'opacity-70' : ''}`}
                            onError={(e) => {
                            console.warn(`Failed to load image: ${mediaUrlToUse}`);
                            // Replace broken image with a placeholder div *inside* the CardContent
                            const parent = e.currentTarget.parentElement?.parentElement; // Target the CardContent
                            if (parent && !parent.querySelector('.error-placeholder')) {
                                // Hide the link containing the image
                                const imageContainerLink = e.currentTarget.parentElement;
                                if (imageContainerLink) imageContainerLink.style.display = 'none';
                                // Hide the background image too if the main one fails
                                const backgroundSibling = parent.querySelector('img[aria-hidden="true"]');
                                if (backgroundSibling instanceof HTMLElement) backgroundSibling.style.display = 'none';

                                const placeholderDiv = document.createElement('div');
                                placeholderDiv.className = 'error-placeholder relative z-10 flex items-center justify-center bg-muted text-muted-foreground text-xs p-2 text-center w-full h-full min-h-[300px]'; // Ensure it's above background
                                placeholderDiv.textContent = 'Image failed to load';
                                parent.appendChild(placeholderDiv);
                            }
                            }}
                            unoptimized={mediaUrlToUse.endsWith('.gif')} // Avoid optimization for GIFs if causing issues
                        />
                    )}
                    {(item.mediaType === 'video' || item.mediaType === 'redgifs') && (
                         <div className="w-full h-full flex items-center justify-center">
                            {/* Provide a visual indicator for video/gif, maybe a play button overlay? */}
                            {/* Actual video playback here is complex due to potential CORS and format issues */}
                            <div className="text-center p-4 text-foreground">
                                {item.mediaType === 'video' && <Video className="h-16 w-16 mx-auto text-muted-foreground mb-2" />}
                                {item.mediaType === 'redgifs' && <Film className="h-16 w-16 mx-auto text-muted-foreground mb-2" />}
                                <p className="text-sm">Click to view {item.mediaType}</p>
                                <p className="text-xs text-muted-foreground break-all">{mediaUrlToUse}</p>
                            </div>
                        </div>
                    )}
                 </a>
              </CardContent>
               {/* Footer with Download Button */}
              <CardFooter className="p-2 bg-card border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full" // Make button full width
                  onClick={(e) => {
                      e.stopPropagation(); // Prevent the click from propagating to the link wrapping the image
                      handleDownload(mediaUrlToUse, mediaTitle);
                    }}
                  disabled={isPlaceholder || !mediaUrlToUse} // Disable download for placeholder or missing URL
                  aria-label={`Download ${mediaTitle}`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download {item.mediaType} {/* Indicate type */}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
  );
}
