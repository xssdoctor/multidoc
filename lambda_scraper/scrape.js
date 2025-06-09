const { chromium } = require('playwright');

async function scrapeLambdaChat(prompt) {
  // Log start time
  const startTime = new Date();
  console.error(`[${new Date().toISOString()}] Starting Lambda.Chat scraper...`);
  
  // Create a browser instance with stealth options
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio'
    ]
  });
  
  try {
    // Create a new context with specific user agent and viewport
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      hasTouch: false,
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      bypassCSP: true, // Bypass Content-Security-Policy
      permissions: ['clipboard-read', 'clipboard-write'] // Grant permissions
    });
    
    // Create a new page
    const page = await context.newPage();
    
    // Set default timeout to 120 seconds (increased from 60)
    page.setDefaultTimeout(120000);
    
    // Add some randomization to appear more human-like
    await page.addInitScript(() => {
      // Override navigator properties
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
      
      // Add random mouse movements
      window.addEventListener('mousemove', () => {
        window.lastMouseMove = Date.now();
      });
    });
    
    // Navigate to Lambda.Chat
    console.error(`[${new Date().toISOString()}] Navigating to Lambda.Chat...`);
    await page.goto('https://lambda.chat/', { waitUntil: 'networkidle', timeout: 90000 });
    
    // Wait for the page to load completely
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit to ensure the page is fully loaded
    await page.waitForTimeout(5000);
    
    // Try to click the settings button with retry logic
    console.error(`[${new Date().toISOString()}] Clicking settings button...`);
    try {
      await page.click('a[aria-label="Settings"]', { timeout: 20000 });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error clicking settings button: ${error.message}`);
      console.error(`[${new Date().toISOString()}] Retrying with different approach...`);
      
      // Try using JavaScript click as an alternative
      await page.evaluate(() => {
        const settingsButtons = Array.from(document.querySelectorAll('a')).filter(el => 
          el.getAttribute('aria-label') === 'Settings' || 
          el.textContent.includes('Settings') ||
          el.innerHTML.includes('Settings')
        );
        if (settingsButtons.length > 0) {
          settingsButtons[0].click();
        } else {
          throw new Error('Settings button not found');
        }
      });
      
      // Wait a bit after the click
      await page.waitForTimeout(3000);
    }
    
    // Wait for and click the DeepSeek model option
    console.error(`[${new Date().toISOString()}] Selecting DeepSeek model...`);
    try {
      await page.waitForSelector('a[href="/settings/deepseek-r1"]', { timeout: 20000 });
      await page.click('a[href="/settings/deepseek-r1"]');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error selecting DeepSeek model: ${error.message}`);
      console.error(`[${new Date().toISOString()}] Trying alternative selector...`);
      
      // Try using a more general selector
      await page.evaluate(() => {
        const deepSeekLinks = Array.from(document.querySelectorAll('a')).filter(el => 
          el.getAttribute('href')?.includes('deepseek') || 
          el.textContent.includes('DeepSeek') ||
          el.innerHTML.includes('DeepSeek')
        );
        if (deepSeekLinks.length > 0) {
          deepSeekLinks[0].click();
        } else {
          throw new Error('DeepSeek link not found');
        }
      });
      
      // Wait a bit after the click
      await page.waitForTimeout(3000);
    }
    
    // Click the "New chat" button
    console.error(`[${new Date().toISOString()}] Starting new chat...`);
    try {
      await page.waitForSelector('button[name="Activate model"]', { timeout: 20000 });
      await page.click('button[name="Activate model"]');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error clicking 'New chat' button: ${error.message}`);
      console.error(`[${new Date().toISOString()}] Trying alternative approach...`);
      
      // Try using a more general selector
      await page.evaluate(() => {
        const newChatButtons = Array.from(document.querySelectorAll('button')).filter(el => 
          el.getAttribute('name')?.includes('Activate') || 
          el.textContent.includes('New chat') ||
          el.innerHTML.includes('New chat')
        );
        if (newChatButtons.length > 0) {
          newChatButtons[0].click();
        } else {
          throw new Error('New chat button not found');
        }
      });
    }
    
    // Wait for the input field to appear
    console.error(`[${new Date().toISOString()}] Waiting for input field...`);
    
    // Add a longer delay to ensure the chat interface is fully loaded
    await page.waitForTimeout(5000);
    
    // Try multiple selectors for the input field
    let inputField = null;
    try {
      inputField = await page.waitForSelector('textarea[placeholder="Ask anything"]', { timeout: 20000 });
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Primary selector failed, trying alternative...`);
      try {
        inputField = await page.waitForSelector('textarea', { timeout: 20000 });
      } catch (e) {
        console.error(`[${new Date().toISOString()}] Alternative selector failed, trying JavaScript approach...`);
        
        // Try using JavaScript to find and focus the input field
        await page.evaluate(() => {
          const textareas = document.querySelectorAll('textarea');
          if (textareas.length > 0) {
            textareas[0].focus();
            return true;
          }
          return false;
        });
        
        // Use the page object directly for typing if we couldn't get a specific element
        await page.keyboard.type(prompt, { delay: Math.floor(Math.random() * 100) + 30 });
        await page.keyboard.press('Enter');
        
        // Skip the rest of the input field interaction
        inputField = null;
      }
    }
    
    if (inputField) {
      // Type the prompt with human-like typing
      console.error(`[${new Date().toISOString()}] Typing prompt: ${prompt}`);
      await inputField.focus();
      
      // Type with random delays between keystrokes to appear more human-like
      for (const char of prompt) {
        await inputField.type(char, { delay: Math.floor(Math.random() * 100) + 30 });
      }
      
      // Submit the prompt using Enter key instead of clicking the button
      console.error(`[${new Date().toISOString()}] Submitting prompt using Enter key...`);
      await inputField.press('Enter');
    }
    
    // Wait for the response to appear
    console.error(`[${new Date().toISOString()}] Waiting for response...`);
    try {
      await page.waitForSelector('.prose', { timeout: 120000 });
      
      // Wait for the response to contain content (look for strong tag)
      await page.waitForSelector('.prose strong', { timeout: 120000 });
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error waiting for response: ${error.message}`);
      console.error(`[${new Date().toISOString()}] Trying alternative approach to get response...`);
      
      // Wait a bit more to see if the response appears
      await page.waitForTimeout(10000);
    }
    
    // Wait a bit more to ensure the response is complete
    console.error(`[${new Date().toISOString()}] Response started, waiting for completion...`);
    await page.waitForTimeout(10000);
    
    // Extract the response text
    let responseText = "";
    try {
      responseText = await page.textContent('.prose');
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error extracting response text: ${error.message}`);
      console.error(`[${new Date().toISOString()}] Trying alternative approach...`);
      
      // Try using JavaScript to extract the text
      responseText = await page.evaluate(() => {
        const proseElements = document.querySelectorAll('.prose');
        if (proseElements.length > 0) {
          return proseElements[0].textContent;
        }
        
        // If .prose not found, try to find any response container
        const possibleResponseContainers = document.querySelectorAll('div[class*="response"], div[class*="message"], div[class*="answer"]');
        if (possibleResponseContainers.length > 0) {
          return possibleResponseContainers[possibleResponseContainers.length - 1].textContent;
        }
        
        return "Could not extract response from Lambda.Chat";
      });
    }
    
    // Calculate and log execution time
    const endTime = new Date();
    const executionTime = (endTime - startTime) / 1000;
    console.error(`[${new Date().toISOString()}] Scraping completed in ${executionTime.toFixed(2)} seconds`);
    
    // Output the response text to stdout
    console.log(responseText);
    
    return responseText;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error: ${error.message}`);
    throw error;
  } finally {
    // Close the browser
    await browser.close();
  }
}

// Get the prompt from command line arguments
const prompt = process.argv[2];

if (!prompt) {
  console.error('Error: No prompt provided. Usage: node scrape.js "your prompt here"');
  process.exit(1);
}

// Run the scraper
scrapeLambdaChat(prompt)
  .catch(error => {
    console.error(`Error during scraping: ${error.message}`);
    process.exit(1);
  });
