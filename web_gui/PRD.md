# Product Requirements Document: multidoc

## 1. Introduction

`multidoc` is a versatile application designed to facilitate interaction with multiple Large Language Models (LLMs) and external data sources. It aims to provide a unified interface for querying different AI models and integrating information scraped from platforms like Lambda.Chat.

## 2. Goals

*   Provide a seamless experience for users to interact with various LLMs (OpenAI, Claude, Gemini).
*   Enable users to easily scrape and utilize data from Lambda.Chat.
*   Offer a user-friendly web-based Graphical User Interface (GUI) for all functionalities.
*   Maintain flexibility for future expansion with additional LLMs or data sources.

## 3. Target Audience

*   Developers and researchers working with LLMs.
*   Users who need to compare outputs from different AI models.
*   Individuals who require information from Lambda.Chat integrated into their workflows.

## 4. Key Features

*   **Multi-LLM Interaction:**
    *   Support for OpenAI models (e.g., "gpt-4o", "gpt-4.1", "o3", "o4-mini").
    *   Support for Anthropic Claude models (e.g., "claude-3-7-sonnet-20250219").
    *   Support for Google Gemini models (e.g., "gemini-2.5-pro-exp-03-25", "gemini-2.5-flash-preview-04-17").
*   **Lambda.Chat Scraper:**
    *   Functionality to scrape data from Lambda.Chat using a Node.js script (`lambda_scraper/scrape.js`).
    *   Triggered via a command-line flag (`-lc`).
*   **Web GUI:**
    *   An intuitive web interface for accessing all features of `multidoc`.

## 5. Technical Considerations

*   The application is built using Go.
*   The Lambda.Chat scraper is a Node.js script executed by the Go backend.
*   Specific model identifiers must be maintained as per current working versions (see MEMORY[6c3ad10d-dbc3-460e-bb39-56835ca4828f]).

## 6. Success Metrics

*   User adoption and engagement with the web GUI.
*   Successful and reliable interaction with all supported LLMs.
*   Accurate and efficient scraping of Lambda.Chat data.
*   Positive user feedback on ease of use and functionality.

## 7. Future Considerations

*   Integration of additional LLMs.
*   Support for more data sources beyond Lambda.Chat.
*   Advanced features for comparing LLM outputs.
*   Enhanced customization options in the web GUI.
*   Improved error handling and logging.
*   Comprehensive documentation for users and developers.
