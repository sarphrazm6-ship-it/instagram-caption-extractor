// Instagram Caption Extractor - Backend Server
// Node.js + Express

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files

// Extract shortcode from Instagram URL
function extractShortcode(url) {
    const match = url.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
}

// Method 1: Try Instagram's embed endpoint
async function getInstagramData(shortcode) {
    try {
        const url = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        // Try to extract caption from response
        if (response.data) {
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            
            // Navigate the Instagram API response structure
            const edges = data?.items?.[0] || data?.graphql?.shortcode_media;
            
            if (edges) {
                const caption = edges.edge_media_to_caption?.edges?.[0]?.node?.text ||
                               edges.caption?.text ||
                               edges.title ||
                               '';
                
                return {
                    success: true,
                    caption: caption,
                    username: edges.owner?.username || 'Unknown',
                    likes: edges.like_count || edges.edge_liked_by?.count || 0
                };
            }
        }
        
        return { success: false, error: 'Could not extract caption' };
    } catch (error) {
        console.error('Instagram API Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Method 2: Alternative scraping method
async function scrapeInstagramPage(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        });

        const html = response.data;
        
        // Try to find caption in the HTML
        // Instagram embeds data in <script> tags
        const scriptMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
        
        if (scriptMatch) {
            const jsonData = JSON.parse(scriptMatch[1]);
            if (jsonData.caption) {
                return {
                    success: true,
                    caption: jsonData.caption,
                    method: 'scraping'
                };
            }
        }

        // Alternative: Look for meta tags
        const metaMatch = html.match(/<meta property="og:description" content="(.*?)"/);
        if (metaMatch) {
            return {
                success: true,
                caption: metaMatch[1],
                method: 'meta-tags'
            };
        }

        return { success: false, error: 'Caption not found in page' };
    } catch (error) {
        console.error('Scraping Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Main API endpoint
app.post('/api/extract-caption', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        // Validate Instagram URL
        const instagramPattern = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|reels|p)\/[\w-]+/i;
        if (!instagramPattern.test(url)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Instagram URL'
            });
        }

        const shortcode = extractShortcode(url);
        if (!shortcode) {
            return res.status(400).json({
                success: false,
                error: 'Could not extract shortcode from URL'
            });
        }

        // Try different methods
        let result = await getInstagramData(shortcode);
        
        if (!result.success) {
            result = await scrapeInstagramPage(url);
        }

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json({
                success: false,
                error: 'Could not fetch caption. The reel might be private or Instagram blocked the request.'
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📝 Instagram Caption Extractor API ready!`);
});

module.exports = app;
