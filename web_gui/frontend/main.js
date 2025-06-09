document.addEventListener('DOMContentLoaded', function () {
    const loginContainer = document.getElementById('loginContainer');
    const appWrapper = document.getElementById('appWrapper');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    const form = document.getElementById('runCommandForm');
    const outputArea = document.getElementById('outputArea');
    const runButton = document.getElementById('runButton');
    const loadingAnimation = document.getElementById('loadingAnimation');
    const historyList = document.getElementById('historyList');
    const promptTextarea = document.getElementById('prompt');
    const metadataArea = document.getElementById('metadataArea'); // Added metadata area

    let chatHistory = [];

    // Initialize the output area
    outputArea.innerHTML = '<p class="initial-message">Enter your prompt and click Explore to get insights from multiple AI models.</p>';

    const isHighlightJsAvailable = typeof hljs !== 'undefined';

    marked.setOptions({
        renderer: new marked.Renderer(),
        highlight: function(code, lang) {
            if (isHighlightJsAvailable) {
                try {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    return hljs.highlight(code, { language }).value;
                } catch (error) {
                    console.error('Highlight.js error:', error);
                    return code;
                }
            }
            return code;
        },
        langPrefix: isHighlightJsAvailable ? 'hljs language-' : '',
        pedantic: false,
        gfm: true,
        breaks: true,
        sanitize: false,
        smartypants: false,
        xhtml: false
    });

    function renderHistory() {
        historyList.innerHTML = '';
        if (chatHistory.length === 0) {
            historyList.innerHTML = '<li><p class="no-history">No history yet.</p></li>';
            return;
        }
        // Display in reverse chronological order (newest first)
        chatHistory.slice().reverse().forEach((item, index) => {
            const originalIndex = chatHistory.length - 1 - index;
            const listItem = document.createElement('li');
            listItem.classList.add('history-item');
            
            const promptSummary = item.prompt.length > 40 ? item.prompt.substring(0, 37) + '...' : item.prompt;
            
            // Create a very short summary for the response, stripping HTML/Markdown for display
            let responseText = item.response.replace(/<[^>]*>/g, "").replace(/\n/g, " "); // Basic strip
            const responseSummary = responseText.length > 60 ? responseText.substring(0, 57) + '...' : responseText;

            listItem.innerHTML = `
                <div class="history-prompt-summary" title="${item.prompt.replace(/"/g, '&quot;')}">${promptSummary}</div>
                <div class="history-response-summary" title="${responseText.replace(/"/g, '&quot;')}">${responseSummary}</div>
            `;
            listItem.addEventListener('click', () => loadHistoryItem(originalIndex));
            historyList.appendChild(listItem);
        });
    }

    function loadHistoryItem(index) {
        if (index < 0 || index >= chatHistory.length) return;
        const item = chatHistory[index];
        
        promptTextarea.value = item.prompt;
        promptTextarea.style.height = 'auto';
        promptTextarea.style.height = (promptTextarea.scrollHeight) + 'px';

        outputArea.innerHTML = ''; // Clear previous content
        metadataArea.textContent = ''; // Clear previous metadata

        const { mainContent: rawMainContent, metadata } = splitOutputAndMetadata(item.response);

        let formattedMainContent = rawMainContent;
        // Apply specific formatting only to main content if needed
        formattedMainContent = formattedMainContent.replace(/(Error from .*)/g, '> **$1**');
        // Add other main-content specific formatting here if any

        outputArea.innerHTML = marked.parse(formattedMainContent);
        metadataArea.textContent = metadata;
        if (isHighlightJsAvailable) {
            try {
                document.querySelectorAll('.output-area pre code').forEach((block) => {
                    hljs.highlightElement(block);
                });
            } catch (error) {
                console.error('Error applying syntax highlighting on history load:', error);
            }
        }
        // Scroll main content to top to see prompt and beginning of response
        const mainContentWrapper = document.querySelector('.main-content-wrapper');
        if (mainContentWrapper) mainContentWrapper.scrollTop = 0;
        outputArea.scrollTop = 0; // Scroll output area to top as well
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        
        outputArea.innerHTML = '';
        metadataArea.textContent = ''; // Also clear metadata area on new submission
        loadingAnimation.style.display = 'block';
        runButton.disabled = true;

        const buttonText = document.querySelector('.button-text');
        const buttonIcon = document.querySelector('.button-icon');
        const originalButtonText = buttonText.textContent;
        buttonText.textContent = 'Processing';
        buttonIcon.textContent = '•••';

        const currentPromptValue = promptTextarea.value;
        const currentPrompt = currentPromptValue.trim();

        if (!currentPrompt) {
            outputArea.innerHTML = '<p class="error">Please enter a prompt to explore.</p>';
            loadingAnimation.style.display = 'none';
            runButton.disabled = false;
            buttonText.textContent = originalButtonText;
            buttonIcon.textContent = '→';
            return;
        }

        const data = {
            prompt: currentPrompt,
            lambdaChat: true, 
        };

        try {
            const response = await fetch('/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();
            
            loadingAnimation.style.display = 'none';
            runButton.disabled = false;
            buttonText.textContent = originalButtonText;
            buttonIcon.textContent = '→';
            
            if (response.ok) {
                outputArea.innerHTML = ''; // Clear previous content
                metadataArea.textContent = ''; // Clear previous metadata

                const { mainContent: rawMainContent, metadata } = splitOutputAndMetadata(result.output);

                let formattedMainContent = rawMainContent;
                // Apply specific formatting only to main content
                // The model timing and summary lines are now in metadata, so no need to bold/header them here.
                formattedMainContent = formattedMainContent.replace(/(Error from .*)/g, '> **$1**');

                outputArea.innerHTML = marked.parse(formattedMainContent);
                metadataArea.textContent = metadata;
                
                // Create history item
                const historyItem = { prompt: currentPromptValue, response: result.output }; // Store the original, unsplit output
                // Send to server and refresh history from server
                await addHistoryItemToServer(historyItem);
                
                if (isHighlightJsAvailable) {
                    try {
                        document.querySelectorAll('.output-area pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    } catch (error) {
                        console.error('Error applying syntax highlighting:', error);
                    }
                }

                document.querySelector('.result-container').scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest' 
                });
            } else {
                outputArea.innerHTML = `<div class="error-container">
                    <p class="error">Error: ${result.error}</p>
                    ${result.output ? `<p class="error-output">${result.output}</p>` : ''}
                </div>`;
                 // Optionally, save errors to history too, or handle differently
                // chatHistory.push({ prompt: currentPromptValue, response: `Error: ${result.error}` });
                // renderHistory();
            }
        } catch (error) {
            loadingAnimation.style.display = 'none';
            runButton.disabled = false;
            buttonText.textContent = originalButtonText;
            buttonIcon.textContent = '→';
            outputArea.innerHTML = `<p class="error">Connection error: ${error.message}</p>
                <p>Please check your network connection and try again.</p>`;
            // Optionally, save connection errors
            // chatHistory.push({ prompt: currentPromptValue, response: `Connection error: ${error.message}` });
            // renderHistory();
        }
    });

    promptTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Initial render of history sidebar
    renderHistory();

    // Helper function to split main content from metadata
    function splitOutputAndMetadata(fullOutput) {
        const lines = fullOutput.split('\n');
        let mainContentLines = [];
        let metadataLines = [];
        let foundDelimiter = false;
        const summaryDelimiterPattern = /^={10,}\s*Summary.*={10,}$/;

        for (const line of lines) {
            if (!foundDelimiter && summaryDelimiterPattern.test(line)) {
                foundDelimiter = true;
            }

            if (foundDelimiter) {
                metadataLines.push(line);
            } else {
                mainContentLines.push(line);
            }
        }

        // If delimiter was never found, assume all is main content
        if (!foundDelimiter && metadataLines.length === 0 && mainContentLines.length > 0) {
            return { mainContent: fullOutput, metadata: "" };
        }
        
        return {
            mainContent: mainContentLines.join('\n').trimEnd(),
            metadata: metadataLines.join('\n').trim()
        };
    }

    async function checkLoginStatus() {
        try {
            const response = await fetch('/check_auth');
            const data = await response.json();
            if (data.logged_in) {
                loginContainer.classList.add('hidden');
                appWrapper.classList.remove('hidden');
                await fetchHistory(); // Fetch history if already logged in
            } else {
                loginContainer.classList.remove('hidden');
                appWrapper.classList.add('hidden');
            }
        } catch (error) {
            console.error('Error checking login status:', error);
            loginError.textContent = 'Error connecting to server. Please try again later.';
            loginContainer.classList.remove('hidden'); // Ensure login is shown if error
            appWrapper.classList.add('hidden');
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            loginError.textContent = ''; // Clear previous errors
            const username = usernameInput.value;
            const password = passwordInput.value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (response.ok) {
                    await checkLoginStatus(); // This will hide login and show app
                    await fetchHistory();     // Fetch user's history after login
                } else {
                    loginError.textContent = data.message || 'Login failed. Please check your credentials.';
                }
            } catch (error) {
                console.error('Login error:', error);
                loginError.textContent = 'Error during login. Please try again.';
            }
        });
    }

    async function fetchHistory() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error fetching history:', errorData.error || response.statusText);
                chatHistory = []; // Clear local cache on error
            } else {
                chatHistory = await response.json();
            }
        } catch (error) {
            console.error('Network error fetching history:', error);
            chatHistory = []; // Clear local cache on network error
        }
        renderHistory(); // Always re-render, even if history is now empty
    }

    async function addHistoryItemToServer(item) {
        try {
            const response = await fetch('/api/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(item)
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Error saving history item:', errorData.message || response.statusText);
                // Optionally, notify the user that saving failed
            } else {
                // Successfully saved, now refresh the entire history from server
                // This ensures consistency if history could be modified elsewhere (though unlikely here)
                // and also simplifies state management by always having one source of truth for display.
                await fetchHistory();
            }
        } catch (error) {
            console.error('Network error saving history item:', error);
            // Optionally, notify the user
        }
    }

    // Initial check
    checkLoginStatus();
    // Note: fetchHistory() is called after successful login inside checkLoginStatus/loginForm handler
});
