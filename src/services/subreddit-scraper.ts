
/**
 * @fileoverview Service for fetching trendy media (images, videos, gifs) from a subreddit using the Reddit API.
 */

/**
 * Represents a media post retrieved from the Reddit API.
 */
export interface MediaPost {
  /**
   * The direct URL of the media (image, video source, or Redgifs link).
   */
  mediaUrl: string;
  /**
   * The type of media ('image', 'video', 'redgifs').
   */
  mediaType: 'image' | 'video' | 'redgifs';
  /**
   * The title of the Reddit post.
   */
  title: string;
   /**
    * The full URL to the Reddit post page.
    */
   redditUrl: string;
}


// --- Reddit API Types (simplified) ---
interface RedditTokenResponse {
  access_token: string;
  token_type: string; // Should be "bearer"
  expires_in: number; // Duration in seconds (usually 3600)
  scope: string;
}

interface RedditPostData {
  title: string;
  name: string; // Fullname, e.g., t3_abcde
  permalink: string; // Relative URL to the post, e.g., /r/pics/comments/.../
  url: string; // URL the post links to
  post_hint?: 'image' | 'hosted:video' | 'link' | 'rich:video' | 'self'; // Hint about the content
  is_video: boolean;
  is_gallery?: boolean;
  stickied?: boolean; // Check if the post is stickied
  domain: string; // e.g., "i.redd.it", "v.redd.it", "redgifs.com"
  preview?: { // Preview images, useful for various link types
    images: {
      source: {
        url: string;
        width: number;
        height: number;
      };
      resolutions: {
        url: string;
        width: number;
        height: number;
      }[];
    }[];
    enabled: boolean;
    // Sometimes video previews are here
    reddit_video_preview?: {
        fallback_url?: string;
        hls_url?: string;
        dash_url?: string;
        duration: number;
        height: number;
        width: number;
        is_gif: boolean;
    };
  };
  media?: { // Often contains video information
      reddit_video?: {
          fallback_url?: string; // MP4 video URL
          hls_url?: string; // HLS stream URL
          dash_url?: string; // DASH stream URL
          duration: number;
          height: number;
          width: number;
          is_gif: boolean;
      };
       // Information about embeds like Redgifs
       oembed?: {
           provider_url?: string;
           provider_name?: string; // e.g., "Redgifs"
           thumbnail_url?: string;
           html?: string; // Embed HTML
       };
  };
  // Add other fields if needed, e.g., secure_media_embed for some videos/gifs
  secure_media_embed?: {
      content?: string; // Often contains iframe for embeds
      media_domain_url?: string; // URL of the embedded content
  };
  // Gallery data if is_gallery is true
  media_metadata?: {
    [key: string]: {
        status: string; // "valid"
        e: string; // Type, e.g., "Image"
        m: string; // Mime type, e.g., "image/jpeg"
        p?: { // Previews of different sizes
            u: string; // URL of the preview
            x: number; // width
            y: number; // height
        }[];
        s?: { // Source image/video in gallery
            u?: string; // URL
            x: number; // width
            y: number; // height
        };
    };
  };
  over_18?: boolean; // NSFW flag
}

interface RedditListingChild {
  kind: string; // e.g., "t3" for posts
  data: RedditPostData;
}

interface RedditListingData {
  after: string | null; // For pagination
  dist: number;
  modhash: string;
  geo_filter: string | null;
  children: RedditListingChild[];
  before: string | null; // For pagination
}

interface RedditApiResponse {
  kind: string; // e.g., "Listing"
  data: RedditListingData;
}

// --- End Reddit API Types ---

// --- Simple In-Memory Token Cache ---
let redditAccessToken: string | null = null;
let tokenExpiryTime: number | null = null;
// --- End Token Cache ---


/**
 * Generates a unique User-Agent string required by the Reddit API.
 * Format: <platform>:<app ID>:<version string> (by /u/<reddit username>)
 * Replace placeholders with actual values if known, otherwise use defaults.
 * IMPORTANT: Reddit uses the User-Agent for tracking and enforcing API rules.
 * Using a descriptive and unique User-Agent is crucial.
 * @returns A formatted User-Agent string.
 */
function getUserAgent(): string {
    const platform = "web"; // Or 'node', 'browser', etc.
    const appId = process.env.REDDIT_CLIENT_ID || "unknown-app-id"; // Use env var if available
    const version = "1.1.0"; // Your app's version
    // return `${platform}:${appId}:${version} (by /u/${redditUsername})`;
     return `${platform}:${appId}:${version} (NextJS Subreddit Scraper by Firebase Studio)`; // Example without username
}


/**
 * Retrieves an Application Only OAuth access token from Reddit.
 * Uses client credentials (ID and Secret) from environment variables.
 * Caches the token in memory until it expires.
 * @returns A promise resolving to the access token string.
 * @throws An error if credentials are missing or token fetch fails.
 */
async function getRedditAccessToken(): Promise<string> {
  const now = Date.now();

  // Check cache first
  if (redditAccessToken && tokenExpiryTime && now < tokenExpiryTime) {
    // console.log("Using cached Reddit access token.");
    return redditAccessToken;
  }

  // console.log("Fetching new Reddit access token...");
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET environment variables are not set.");
    throw new Error("Reddit API credentials are missing. Please configure them in your .env file.");
  }

  const tokenUrl = "https://www.reddit.com/api/v1/access_token";
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': getUserAgent(),
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store', // Ensure fresh token fetch
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Failed to get Reddit access token. Status: ${response.status}. Body: ${errorBody}`);
      // More specific error for 401 Unauthorized
      if (response.status === 401) {
         redditAccessToken = null; // Invalidate cache on auth error
         tokenExpiryTime = null;
        throw new Error(`Failed to authenticate with Reddit API. Status: ${response.status} (Unauthorized). Please verify your REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.`);
      }
      throw new Error(`Failed to authenticate with Reddit API. Status: ${response.status}`);
    }

    const tokenData = (await response.json()) as RedditTokenResponse;

    if (tokenData.token_type !== 'bearer' || !tokenData.access_token) {
        console.error("Received invalid token data:", tokenData);
        throw new Error("Failed to get a valid bearer token from Reddit.");
    }


    redditAccessToken = tokenData.access_token;
    // Set expiry time slightly before actual expiry (e.g., 5 minutes buffer)
    tokenExpiryTime = Date.now() + (tokenData.expires_in - 300) * 1000;

    // console.log("Successfully obtained new Reddit access token.");
    return redditAccessToken;
  } catch (error) {
    console.error("Error fetching Reddit access token:", error);
    // Clear potentially stale cache on error
    redditAccessToken = null;
    tokenExpiryTime = null;
    // Re-throw a more user-friendly error or the original one
    if (error instanceof Error && error.message.includes('Failed to authenticate')) {
        throw error;
    }
    if (error instanceof Error && error.message.includes('Reddit API credentials are missing')) {
       throw error;
   }
    throw new Error("Could not connect to Reddit API to get access token.");
  }
}

/**
 * Extracts the subreddit name from a full URL.
 * @param url The full subreddit URL (e.g., https://www.reddit.com/r/pics/).
 * @returns The subreddit name (e.g., "pics") or null if the URL is invalid.
 */
function extractSubredditName(url: string): string | null {
    try {
        const parsedUrl = new URL(url);
        const pathParts = parsedUrl.pathname.split('/').filter(part => part !== ''); // Split and remove empty parts
        // Check if path starts with 'r' and has a name after it
        if (pathParts.length >= 2 && pathParts[0].toLowerCase() === 'r') {
            return pathParts[1];
        }
        return null;
    } catch (e) {
        // Invalid URL format
        return null;
    }
}


/**
 * Asynchronously fetches media (images, videos, Redgifs) from trendy ('hot') posts in a given subreddit using the Reddit API.
 * Retrieves posts from the 'hot' listing. Filters out stickied posts and galleries by default.
 *
 * @param subredditUrl The full URL of the subreddit (e.g., https://www.reddit.com/r/pics/).
 * @param limit The maximum number of posts to fetch (default 25, max 100 per Reddit API).
 * @returns A promise that resolves to an array of MediaPost objects or null if the subreddit is invalid/inaccessible.
 * @throws An error if API authentication fails or a critical API error occurs.
 */
export async function scrapeTrendyImages(subredditUrl: string, limit: number = 25): Promise<MediaPost[] | null> {
  const subredditName = extractSubredditName(subredditUrl);

  if (!subredditName) {
    console.error(`Invalid subreddit URL format: ${subredditUrl}`);
    throw new Error("Invalid subreddit URL format. Please use the format: https://www.reddit.com/r/subredditname/");
  }

  console.log(`Fetching trendy media from r/${subredditName} (limit: ${limit}) using Reddit API...`);

  let accessToken: string;
  try {
      accessToken = await getRedditAccessToken();
  } catch (authError) {
      console.error("Authentication failed:", authError);
       if (authError instanceof Error) throw authError; // Re-throw specific auth errors
       throw new Error("Failed to obtain Reddit API access token."); // Generic fallback
  }

  // THIS LINE USES '/hot' - fetches trending/hot posts already
  const apiUrl = `https://oauth.reddit.com/r/${subredditName}/hot?limit=${Math.min(limit, 100)}`; // Use oauth domain

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': getUserAgent(),
      },
       cache: 'no-store', // Avoid caching API responses
    });

     // Log basic response status
     console.log(`Reddit API response status for r/${subredditName}: ${response.status} ${response.statusText}`);

    if (!response.ok) {
       const errorBody = await response.text(); // Read body for more details
       console.error(`Failed to fetch r/${subredditName} data. Status: ${response.status}. Body: ${errorBody}`);

       if (response.status === 401) {
         // Token likely expired or invalid, clear cache and throw specific error
         redditAccessToken = null;
         tokenExpiryTime = null;
         throw new Error(`Reddit API authentication failed (401 Unauthorized). Access token might be expired or invalid. Please ensure credentials in .env are correct.`);
       }
       if (response.status === 404) {
         throw new Error(`Subreddit 'r/${subredditName}' not found or is private (404).`);
       }
       if (response.status === 403) {
         // Could be permissions, banned user-agent, IP block etc.
         throw new Error(`Access denied (403 Forbidden) when fetching r/${subredditName}. Possible reasons: Invalid API key permissions, blocked User-Agent, IP restrictions, or subreddit access rules.`);
       }
       if (response.status === 429) {
          throw new Error(`Rate limited by Reddit (429 Too Many Requests). Please wait and try again later.`);
       }
       // Generic error for other failed statuses
       throw new Error(`Failed to fetch data from Reddit API. Status: ${response.status}. Details: ${errorBody.substring(0, 100)}...`);
    }

    const listing = (await response.json()) as RedditApiResponse;

    // console.log("Reddit API Raw Response Data:", JSON.stringify(listing, null, 2)); // Log raw response for debugging

    if (listing.kind !== 'Listing' || !listing.data || !listing.data.children) {
      console.error("Unexpected API response structure:", listing);
      throw new Error("Received invalid data structure from Reddit API.");
    }

    const mediaPosts: MediaPost[] = [];
    let skippedCount = 0;

    listing.data.children.forEach((child, index) => {
        if (child.kind !== 't3' || !child.data) {
            console.warn(`Skipping item at index ${index}: Not a post or missing data.`);
            skippedCount++;
            return;
        }

        const postData = child.data;
        const redditUrl = `https://www.reddit.com${postData.permalink}`;

        // Skip stickied posts and galleries by default
        if (postData.stickied) {
             // console.log(`Skipping stickied post: "${postData.title}"`);
             skippedCount++;
             return;
        }
        if (postData.is_gallery) {
             // console.log(`Skipping gallery post: "${postData.title}"`);
             // Future enhancement: Could potentially extract first image from gallery metadata
             skippedCount++;
             return;
        }

        let foundMedia: Omit<MediaPost, 'title' | 'redditUrl'> | null = null;

        // 1. Check for direct image links (i.redd.it, imgur.com etc.)
        if (postData.post_hint === 'image' || /\.(jpg|jpeg|png|gif)$/i.test(postData.url)) {
           // Prefer post_hint if available, fallback to extension check
           if (postData.url && !postData.url.includes('gallery')) { // Extra check against accidental gallery links
              foundMedia = { mediaUrl: postData.url, mediaType: 'image' };
           }
        }
        // 2. Check for Reddit hosted videos (v.redd.it)
        else if (postData.is_video && postData.media?.reddit_video?.fallback_url) {
           foundMedia = { mediaUrl: postData.media.reddit_video.fallback_url, mediaType: 'video' };
        }
        // 3. Check for Redgifs (common GIF/short video host)
        else if (postData.domain === 'redgifs.com' || postData.media?.oembed?.provider_name === 'Redgifs') {
            // Try to get a direct link if possible (might be in secure_media_embed or url)
            let redgifsUrl = postData.url; // Default to the post URL
            if (postData.secure_media_embed?.media_domain_url && postData.secure_media_embed.media_domain_url.includes('redgifs.com')) {
               redgifsUrl = postData.secure_media_embed.media_domain_url;
            }
             // Sometimes the direct MP4 is in the preview object
             else if (postData.preview?.reddit_video_preview?.fallback_url && postData.preview.reddit_video_preview.fallback_url.includes('redgifs')) {
                  redgifsUrl = postData.preview.reddit_video_preview.fallback_url;
              }
            foundMedia = { mediaUrl: redgifsUrl, mediaType: 'redgifs' };
        }
         // 4. Check for other potential video/gif embeds (e.g., gfycat, imgur gifs)
         else if (postData.post_hint === 'rich:video' || postData.post_hint === 'link') {
             // Look for common patterns or specific domains if needed
             if (postData.domain === 'gfycat.com' && postData.preview?.reddit_video_preview?.fallback_url) {
                 foundMedia = { mediaUrl: postData.preview.reddit_video_preview.fallback_url, mediaType: 'video' };
             } else if (postData.domain === 'imgur.com' && postData.url.endsWith('.gifv') && postData.preview?.reddit_video_preview?.fallback_url) {
                 foundMedia = { mediaUrl: postData.preview.reddit_video_preview.fallback_url, mediaType: 'video' };
             }
             // Add more domain-specific logic here if necessary
         }

        if (foundMedia && foundMedia.mediaUrl && foundMedia.mediaType === 'image') { // Check if mediaType is 'image'
            // Basic deduplication check based on mediaUrl
            if (!mediaPosts.some(p => p.mediaUrl === foundMedia!.mediaUrl)) {
                mediaPosts.push({
                    ...foundMedia,
                    title: postData.title || 'Untitled Post',
                    redditUrl: redditUrl,
                });
                // console.log(`Added ${foundMedia.mediaType}: ${foundMedia.mediaUrl} (from post: ${postData.title})`);
            } else {
               // console.log(`Skipping duplicate media URL: ${foundMedia.mediaUrl}`);
               skippedCount++;
            }
        } else {
             // Log why a post was skipped (if it wasn't an image or had no suitable media)
             if (foundMedia && foundMedia.mediaType !== 'image') {
                // console.log(`Skipping non-image post: "${postData.title}" Type: ${foundMedia.mediaType}`);
             } else {
                 // console.log(`Skipping post (no suitable media found): "${postData.title}" URL: ${postData.url} Hint: ${postData.post_hint}`);
             }
             skippedCount++;
        }
    });

    console.log(`Successfully processed ${listing.data.children.length} posts. Extracted ${mediaPosts.length} image items. Skipped ${skippedCount} posts (non-images, duplicates, stickied, galleries, or no media).`);

    if (mediaPosts.length === 0 && listing.data.children.length > 0) {
        console.warn(`Found ${listing.data.children.length} posts in r/${subredditName}, but none contained direct image links matching the criteria after filtering.`);
    }

    return mediaPosts;

  } catch (error) {
    console.error(`Error processing Reddit API response for r/${subredditName}:`, error instanceof Error ? error.message : error);

     // If it's one of our specific thrown errors, re-throw it
     if (error instanceof Error && (
         error.message.includes("credentials are missing") ||
         error.message.includes("Failed to authenticate") ||
         error.message.includes("401 Unauthorized") || // Specific auth fail
         error.message.includes("Could not connect") ||
         error.message.includes("Invalid subreddit URL format") ||
         error.message.includes("(404)") ||
         error.message.includes("(403)") ||
         error.message.includes("(429)") ||
         error.message.includes("invalid data structure")
     )) {
        throw error;
     }

    // Generic fallback error
    throw new Error(`An unexpected error occurred while processing data from Reddit API for r/${subredditName}.`);
    // Returning null might hide the underlying issue, throwing is often better here.
    // return null;
  }
}
