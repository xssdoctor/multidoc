# multidoc

[![Go Version](https://img.shields.io/badge/Go-1.18+-00ADD8.svg)](https://golang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Go-based utility that processes input through multiple AI models concurrently (OpenAI, Claude, Gemini, and optionally Lambda.Chat) and provides a combined response, preserving the best parts of each individual output. Ideal for research, comparison, and leveraging the strengths of different models (often referred to as multi-prompting or meta-prompting).

## Features

- **Concurrent Processing:** Sends the same prompt to multiple AI models simultaneously for faster results.
- **Supported Models:**
  - GPT-4o (OpenAI)
  - GPT-4.1 (OpenAI)
  - GPT-o3 (OpenAI)
  - GPT-o4-mini (OpenAI)
  - Claude 3.7 Sonnet (Anthropic)
  - Gemini 2.5 Pro Experimental (Google)
  - Gemini 2.5 Flash Preview (Google)
- **Combined Output:** Uses GPT-o4-mini to intelligently synthesize a single response from all model outputs.
- **Detailed Timing:** Reports execution time for each model and the total process duration.
- **Flexible Input:** Accepts prompts via standard input (stdin), allowing piping from commands or files.
- **(Optional) Lambda.Chat (DeepSeek R1 671b) Scraping:** Includes functionality to scrape responses from Lambda.Chat (which uses DeepSeek R1 671b) using Playwright (requires Node.js).
- **Web UI:** Browser-based interface for easy interaction with the AI models.

## Prerequisites

- **Go:** Version 1.18 or later.
- **API Keys:** You'll need API keys for the services you intend to use:
  - OpenAI API
  - Google Gemini API
  - Anthropic Claude API
- **(Optional) Node.js:** Required only if using the Lambda.Chat scraping feature (`-ld` flag).
- **Python 3.x:** Required for the Web UI backend.

## Installation

### Quick Installation (Recommended)

If you have Go installed, you can install `multidoc` directly:

```bash
go install github.com/xssdoctor/multidoc@latest
```

This will install the latest version of `multidoc` to your Go bin directory. Make sure your Go bin directory is in your PATH.

### Manual Installation

Alternatively, you can clone and build the repository manually:

1.  **Clone the Repository:**

    ```bash
    git clone https://github.com/xssdoctor/multidoc.git
    cd multidoc
    ```

2.  **Install Go Dependencies:**

    ```bash
    go mod download
    ```

3.  **(Optional) Install Node.js Dependencies:** If you plan to use the Lambda.Chat scraper (`-ld` flag):

    ```bash
    cd lambda_scraper
    npm install
    cd ..
    ```

    _Note: `npm install` also downloads the necessary browser binaries for Playwright._

4.  **Install Python Dependencies for Web UI:**
    ```bash
    cd web_gui/backend
    pip install -r requirements.txt
    cd ../..
    ```

## Configuration

`multidoc` requires API keys to interact with the AI services.

1.  **First Run:** The application will automatically create a configuration directory (`~/.config/multidoc`) and a template `.env` file the first time you run it (or try to build it if the directory doesn't exist). It will then exit, prompting you to add your keys.

2.  **Edit `.env` File:** Open the file `~/.config/multidoc/.env` in a text editor.

3.  **Add API Keys:** Add your keys to the file, replacing the placeholder text:
    ```dotenv
    OPENAI_API_KEY=your_openai_api_key
    GEMINI_API_KEY=your_gemini_api_key
    ANTHROPIC_API_KEY=your_anthropic_api_key
    ```

_Alternatively, you can create a `.env` file in the project's root directory._

## Usage

Provide your prompt to `multidoc` via standard input.

```bash
# Example 1: Using a pipe
echo "Compare the benefits of REST vs GraphQL" | go run app.go

# Example 2: Using interactive input (type prompt, then Ctrl+D)
go run app.go

# Example 3: Using a file
cat my_prompt.txt | go run app.go

# Example 4: Using the Lambda.Chat (DeepSeek R1 671b) scraper
echo "Explain the concept of metaprompting" | go run app.go -ld

# Example 5: Using the built executable
echo "Summarize the plot of Hamlet" | ./multidoc
```

**Output:**
The application will display:

- Progress updates as each model responds.
- A final synthesized response.
- Timing information for each model and the total execution time.

## Web UI

Multidoc includes a web-based interface for easier interaction with the AI models.

### Starting the Web UI

1. **Navigate to the backend directory:**

   ```bash
   cd web_gui/backend
   ```

2. **Start the Flask server:**

   ```bash
   python app.py
   ```

3. **Access the web interface:**
   Open your browser and navigate to `http://localhost:5002`

### Authentication

**⚠️ IMPORTANT: Change the default credentials before deploying to production!**

The Web UI comes with default login credentials:

- **Username:** `admin`
- **Password:** `password`

**To change these credentials:**

1. Open `web_gui/backend/app.py`
2. Locate the login function (around line 30)
3. Replace the hardcoded credentials:
   ```python
   if username == 'admin' and password == 'password':
   ```
   with your desired username and password.

**For production use, consider:**

- Using environment variables for credentials
- Implementing a proper user database
- Adding password hashing
- Using a more secure session management system

## Building

To create a standalone executable:

```bash
go build -o multidoc app.go
```

You can then run the compiled application directly (e.g., `./multidoc`).

## Contributing

Contributions are welcome! Please feel free to:

- Open an issue to report bugs or suggest features.
- Submit a pull request with improvements.

## License

This project is licensed under the MIT License. (A `LICENSE` file is recommended but not currently present).

## Author

- xssdoctor
- jhaddix
