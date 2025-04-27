
'use server';

import type { MediaPost } from '@/services/subreddit-scraper'; // Use MediaPost type
import { scrapeTrendyImages } from '@/services/subreddit-scraper'; // Uses Reddit API
import { z } from 'zod';
import nextConfig from '../../next.config.js'; // Import config - use .js extension

interface ScrapeState {
  media: MediaPost[] | null; // Keep as media internally, but filter later
  error: string | null;
  message: string | null;
  timestamp: number;
}

const urlSchema = z.string().url({ message: "Please enter a valid URL." })
  .refine(url => url.includes('reddit.com/r/'), {
    message: "Please enter a valid Reddit subreddit URL (e.g., https://www.reddit.com/r/...)."
  });

// Schema for limit, ensuring it's a positive number within a reasonable range
const limitSchema = z.coerce // Coerce string from FormData to number
  .number()
  .int({ message: "Limit must be a whole number." })
  .positive({ message: "Limit must be positive." })
  .min(1, { message: "Limit must be at least 1." })
  .max(100, { message: "Maximum limit is 100." }) // Reddit API limit
  .default(25); // Default limit if not provided or invalid


// --- Media URL Validation/Sanitization Helpers ---
function getAllowedHostnames(): Set<string> {
    const allowed = new Set<string>([
        'i.redd.it',
        // 'v.redd.it', // Removed video domain
        'preview.redd.it',
        // 'redgifs.com', // Removed redgifs domain
        // 'gfycat.com', // Removed gfycat
        'imgur.com', // Keep imgur for direct image links if needed
        'files.catbox.moe', // Keep catbox for direct image links
    ]);

    const configHostnames = nextConfig.images?.remotePatterns
        ?.map(pattern => pattern.hostname)
        .filter((hostname): hostname is string => !!hostname) ?? [];

    configHostnames.forEach(host => allowed.add(host));
    allowed.add('picsum.photos'); // Keep placeholder

    // console.log("Allowed Hostnames:", Array.from(allowed)); // Debug: Log allowed hostnames
    return allowed;
}
const placeholderImageUrl = `https://picsum.photos/seed/placeholder/400/400`;

function isValidAndAllowedUrl(mediaUrl: string | null | undefined, allowedHostnames: Set<string>): boolean {
    if (!mediaUrl) return false;
    try {
        const url = new URL(mediaUrl);
        // Allow more protocols if necessary (e.g., blob: for local previews, though less common here)
        return (url.protocol === "http:" || url.protocol === "https:") && allowedHostnames.has(url.hostname);
    } catch (_) {
        // console.warn(`Invalid URL format encountered during validation: ${mediaUrl}`); // Log invalid URLs
        return false;
    }
}


// Sanitizes media posts, filtering out non-image posts and replacing invalid/disallowed image URLs.
function sanitizeAndFilterImages(media: MediaPost[], allowedHostnames: Set<string>): MediaPost[] {
    const sanitizedImages: MediaPost[] = [];
    let invalidUrlCount = 0;
    let nonImageCount = 0;

    for (const post of media) {
        // Filter out non-image types first
        if (post.mediaType !== 'image') {
            nonImageCount++;
            // console.log(`Filtering out non-image post: "${post.title}" (Type: ${post.mediaType})`);
            continue;
        }

        const isValid = isValidAndAllowedUrl(post.mediaUrl, allowedHostnames);

        if (isValid) {
            sanitizedImages.push(post); // Keep valid images
        } else {
             invalidUrlCount++;
             console.warn(`Sanitizing/filtering image post "${post.title}" due to invalid/disallowed URL: ${post.mediaUrl}`);
             // Optionally, replace with placeholder if needed for display consistency, but filtering is cleaner
             /*
             sanitizedImages.push({
                 ...post,
                 mediaUrl: placeholderImageUrl, // Replace invalid image URLs
             });
             */
             // Currently, we filter out images with invalid URLs entirely
        }
    }
     if (invalidUrlCount > 0 || nonImageCount > 0) {
        console.log(`Sanitization finished. Filtered out ${nonImageCount} non-image posts and ${invalidUrlCount} images due to invalid or disallowed URLs.`);
     }
    return sanitizedImages;
}

// --- End Media URL Validation/Sanitization Helpers ---


export async function scrapeSubredditAction(
  prevState: ScrapeState,
  formData: FormData
): Promise<ScrapeState> {
  const subredditUrl = formData.get('subredditUrl');
  const limitValue = formData.get('limit'); // Get limit from form data

  // --- Validate URL ---
  const urlParseResult = urlSchema.safeParse(subredditUrl);
  if (!urlParseResult.success) {
    const errorMessage = urlParseResult.error.errors[0]?.message || "Invalid URL provided.";
     return {
        ...prevState, // Keep previous media/messages if any
        media: null, // Clear media on new validation error
        error: errorMessage,
        message: null, // Clear message
        timestamp: Date.now(),
     };
  }
  const validatedUrl = urlParseResult.data;

  // --- Validate Limit ---
  const limitParseResult = limitSchema.safeParse(limitValue);
  if (!limitParseResult.success) {
      const errorMessage = limitParseResult.error.errors[0]?.message || "Invalid limit value provided.";
      return {
          ...prevState,
          media: null,
          error: errorMessage,
          message: null,
          timestamp: Date.now(),
      };
  }
  const validatedLimit = limitParseResult.data;

  // --- Check API Credentials ---
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
       console.error("Missing Reddit API credentials in .env file.");
       return {
           ...prevState,
           media: null,
           error: "Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET) are not configured on the server. Please set them in the .env file.",
           message: null,
           timestamp: Date.now(),
       };
  }
   console.log("Reddit API credentials found.");

  // --- Perform Scraping ---
  try {
     console.log(`Attempting to scrape ${validatedUrl} with limit ${validatedLimit}`);
    // Call the API-based function with validated URL and limit
    const rawMedia = await scrapeTrendyImages(validatedUrl, validatedLimit); // Fetches all media types initially

    // Handle case where scraping function returns null (e.g., major API failure)
    if (rawMedia === null) {
        console.error("scrapeTrendyImages returned null.");
        return {
            ...prevState,
            media: null,
            error: "Failed to retrieve data from Reddit API. The subreddit might be inaccessible or a critical API error occurred.",
            message: null,
            timestamp: Date.now(),
        };
    }

    console.log(`Received ${rawMedia.length} raw media items from scraper.`);

     // Sanitize and filter specifically for images
    const allowedHostnames = getAllowedHostnames();
    const filteredImages = sanitizeAndFilterImages(rawMedia, allowedHostnames); // Use the filtering function

    console.log(`Filtering complete. ${filteredImages.length} valid image items remaining.`);

     // Handle case where NO images are found after filtering
     if (filteredImages.length === 0) {
        const subredditName = validatedUrl.split('/r/')[1]?.split('/')[0] || 'the subreddit';
        let messageText = `Found 0 suitable images in r/${subredditName} with the current filters.`;
        if (rawMedia.length > 0) {
            messageText = `Reddit API returned ${rawMedia.length} posts, but none contained direct image links matching the criteria (e.g., not videos, gifs, galleries, or filtered by allowed domains: ${Array.from(allowedHostnames).join(', ')})`;
        }
        return {
            media: [], // Return empty array for images
            error: null,
            message: messageText, // More informative message
            timestamp: Date.now(),
        };
     }


    // --- Success State ---
     const successMessage = `Successfully fetched ${filteredImages.length} images.`; // Updated success message
     console.log(successMessage);
    return {
      media: filteredImages, // Return only the filtered images
      error: null,
      message: successMessage,
      timestamp: Date.now(),
    };

  } catch (error) {
    console.error("Error during scrapeSubredditAction:", error);
    let errorMessage = "An unexpected error occurred while fetching image data from Reddit."; // Updated error message

    if (error instanceof Error) {
        errorMessage = error.message; // Use the specific error message from the thrown error

        // Optional: Add more specific checks if needed, but rely on messages thrown from service
        if (errorMessage.includes("401 Unauthorized")) {
             errorMessage = `Authentication failed with Reddit API (401). Please check your REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in the .env file. Details: ${error.message}`;
        } else if (errorMessage.includes("403 Forbidden")) {
             errorMessage = `Access denied by Reddit API (403). Check API key permissions, User-Agent, or potential IP restrictions. Details: ${error.message}`;
        } else if (errorMessage.includes("404")) {
             errorMessage = `Subreddit not found or private (404). Please check the URL. Details: ${error.message}`;
        } else if (errorMessage.includes("429 Too Many Requests")) {
             errorMessage = `Rate limited by Reddit API (429). Please wait before trying again. Details: ${error.message}`;
        } else if (errorMessage.includes("credentials are missing")) {
            // Error message already good
        }
    }

    return {
      ...prevState, // Keep previous state for stability? Maybe clear media?
      media: null, // Clear media on error
      error: errorMessage,
      message: null,
      timestamp: Date.now(),
    };
  }
}
