package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	openai "github.com/sashabaranov/go-openai"
)

// API keys loaded from environment variables
var (
	openAIKey string
	claudeKey string
	geminiKey string
)

// loadAPIKeys loads API keys from .env file
func loadAPIKeys() error {
	// Find the .env file
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("error getting home directory: %w", err)
	}

	envPath := filepath.Join(homeDir, ".config", "multidoc", ".env")

	// Load .env file
	err = godotenv.Load(envPath)
	if err != nil {
		return fmt.Errorf("error loading .env file from %s: %w", envPath, err)
	}

	// Get API keys
	openAIKey = os.Getenv("OPENAI_API_KEY")
	claudeKey = os.Getenv("ANTHROPIC_API_KEY")
	geminiKey = os.Getenv("GEMINI_API_KEY")

	// Check if keys are present
	if openAIKey == "" {
		return errors.New("OPENAI_API_KEY not found in .env file")
	}
	if claudeKey == "" {
		return errors.New("ANTHROPIC_API_KEY not found in .env file")
	}
	if geminiKey == "" {
		return errors.New("GEMINI_API_KEY not found in .env file")
	}

	return nil
}

// ModelResponse represents a response from a model
type ModelResponse struct {
	Model    string
	Version  string
	Response string
	Duration time.Duration
	Err      error
}

const (
	// Model version constants
	openAIModelo1     = "o1"
	openAIModel41     = "gpt-4.1"
	openAIModelO3     = "o3"
	openAIModelO4Mini = "o4-mini"
	claudeModel       = "claude-sonnet-4-20250514"
	geminiModelPro    = "gemini-2.5-pro-preview-03-25"
	geminiModelFlash  = "gemini-2.5-flash-preview-04-17"
	lambdaModel       = "DeepSeek R1 671b"
)

func init() {
	// Set up config directory path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("Error getting user home directory: %v", err)
	}

	configDir := filepath.Join(homeDir, ".config", "multidoc")

	// Check if config directory exists, if not create it
	if _, err := os.Stat(configDir); os.IsNotExist(err) {
		err = os.MkdirAll(configDir, 0755)
		if err != nil {
			log.Fatalf("Error creating config directory: %v", err)
		}

		// Create default .env file in the config directory
		envPath := filepath.Join(configDir, ".env")
		envContent := `OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key`

		err = os.WriteFile(envPath, []byte(envContent), 0644)
		if err != nil {
			log.Fatalf("Error creating default .env file: %v", err)
		}

		fmt.Printf("Created default config at: %s\nPlease add your API keys to this file.\n", envPath)
		os.Exit(0) // Exit after creating the config file and showing the message
	}

	// Load .env file from the config directory
	envPath := filepath.Join(configDir, ".env")
	err = godotenv.Load(envPath)
	if err != nil {
		log.Printf("Warning: Error loading .env file from %s: %v", envPath, err)

		// Try loading from current directory as fallback
		err = godotenv.Load()
		if err != nil {
			log.Fatalf("Error loading .env file: %v", err)
		}
	}

	// Load API keys from environment variables
	openAIKey = os.Getenv("OPENAI_API_KEY")
	geminiKey = os.Getenv("GEMINI_API_KEY")
	claudeKey = os.Getenv("ANTHROPIC_API_KEY")

	// Validate that required API keys are set
	if openAIKey == "" || geminiKey == "" || claudeKey == "" {
		log.Fatalf("Missing required API keys in .env file. Please set OPENAI_API_KEY, GEMINI_API_KEY, and ANTHROPIC_API_KEY in %s", envPath)
	}
}

func main() {
	// Define command-line flags
	lcFlag := flag.Bool("lc", false, "Use Lambda.Chat scraping")
	debug := flag.Bool("debug", false, "Print debug information")
	flag.Parse()

	// Start timing
	startTime := time.Now()

	// Read input from stdin
	reader := bufio.NewReader(os.Stdin)
	var input strings.Builder

	for {
		line, err := reader.ReadString('\n')
		if len(line) > 0 { // Append any data read
			input.WriteString(line)
		}
		if err != nil { // Check for errors after attempting to append
			if err == io.EOF { // If EOF, we're done reading
				break
			}
			// For any other error, print it and exit
			fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
			os.Exit(1)
		}
	}

	// Get the prompt from input
	prompt := strings.TrimSpace(input.String())
	if prompt == "" {
		fmt.Fprintf(os.Stderr, "Error: No input provided\n")
		os.Exit(1)
	}

	// Load API keys from .env file
	err := loadAPIKeys()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading API keys: %v\n", err)
		os.Exit(1)
	}

	// Create a channel for collecting responses
	resultsChan := make(chan ModelResponse, 10) // Buffer for multiple models
	var responses []ModelResponse

	// Create a wait group for concurrent execution
	var collectWg sync.WaitGroup

	// Always call OpenAI models
	collectWg.Add(4)
	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callOpenAIAPI("4o", prompt, openAIKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "OpenAI",
			Version:  openAIModelo1,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()
	time.Sleep(1 * time.Second)

	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callOpenAIAPI("4.1", prompt, openAIKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "OpenAI",
			Version:  openAIModel41,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()
	time.Sleep(1 * time.Second)

	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callOpenAIAPI("o3", prompt, openAIKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "OpenAI",
			Version:  openAIModelO3,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()
	time.Sleep(1 * time.Second)

	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callOpenAIAPI("o4-mini", prompt, openAIKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "OpenAI",
			Version:  openAIModelO4Mini,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()

	// Always call Claude
	collectWg.Add(1)
	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callClaudeAPI("claude-3-7-sonnet-20250219", prompt, claudeKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "Claude",
			Version:  claudeModel,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()

	// Always call Gemini models
	collectWg.Add(2)
	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callGeminiAPI(geminiModelPro, prompt, geminiKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "Gemini",
			Version:  geminiModelPro,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()

	go func() {
		defer collectWg.Done()
		startTime := time.Now()
		resp, err := callGeminiAPI(geminiModelFlash, prompt, geminiKey)
		duration := time.Since(startTime)
		resultsChan <- ModelResponse{
			Model:    "Gemini",
			Version:  geminiModelFlash,
			Response: resp,
			Duration: duration,
			Err:      err,
		}
	}()

	// Call Lambda.Chat if the flag is set
	if *lcFlag {
		collectWg.Add(1)
		go func() {
			defer collectWg.Done()
			startTime := time.Now()
			resp, err := scrapeLambdaChat(prompt, *debug)
			duration := time.Since(startTime)
			resultsChan <- ModelResponse{
				Model:    "Lambda.Chat",
				Version:  "Lambda.Chat (DeepSeek R1 671b)",
				Response: resp,
				Duration: duration,
				Err:      err,
			}
		}()
	}

	// Close the results channel when all goroutines are done
	go func() {
		collectWg.Wait()
		close(resultsChan)
	}()

	// Process responses
	for result := range resultsChan {
		if result.Err != nil {
			fmt.Fprintf(os.Stderr, "Error from %s (%s): %v\n", result.Model, result.Version, result.Err)
		} else {
			fmt.Printf("Model %s (%s) finished in %.2f seconds\n", result.Model, result.Version, result.Duration.Seconds())
			if *debug {
				printDebugResponse(result)
			}
			responses = append(responses, result)
		}
	}

	// Generate and print summary
	generateSummary(responses, startTime)
}

// printDebugResponse handles formatting for debug output
func printDebugResponse(resp ModelResponse) {
	fmt.Printf("\n--- Response from %s (%s) (took %.2fs) ---\n%s\n", resp.Model, resp.Version, resp.Duration.Seconds(), resp.Response)
}

// generateSummary generates a summary from the responses
func generateSummary(responses []ModelResponse, startTime time.Time) {
	// Combine all responses into a new prompt for summary generation
	combinedPrompt := "Combine the following outputs from different AI models. Analyze at all of them, combine them, and make sure you don't omit any of each one's individual best parts. Output in markdown format.\n"
	for _, resp := range responses {
		combinedPrompt += fmt.Sprintf("\n\nModel: %s (%s)\nResponse:\n%s", resp.Model, resp.Version, resp.Response)
	}

	// Generate the summary using o4-mini
	summaryStart := time.Now()
	summary, err := callOpenAIAPI("o4-mini", combinedPrompt, openAIKey)
	summaryDuration := time.Since(summaryStart)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error generating summary: %v\n", err)
		os.Exit(1)
	}

	// Print the final output with timing
	fmt.Printf("\n\n==================== Summary (%.2fs) ====================\n\n", summaryDuration.Seconds())
	fmt.Println(summary)

	// Print total execution time
	totalDuration := time.Since(startTime)
	fmt.Printf("\nTotal execution time: %.2f seconds\n", totalDuration.Seconds())
}

// callOpenAIAPI handles API calls to OpenAI models
func callOpenAIAPI(model string, prompt string, apiKey string) (string, error) {
	// Create OpenAI client
	client := openai.NewClient(apiKey)

	// Determine the appropriate model version string based on the model parameter
	var modelVersion string
	switch model {
	case "4o":
		modelVersion = "gpt-4o"
	case "4.1":
		modelVersion = "gpt-4.1"
	case "o3":
		modelVersion = "o3"
	case "o4-mini":
		modelVersion = "o4-mini"
	default:
		modelVersion = model // Use the provided model string directly if it doesn't match any known models
	}

	// Create chat completion request
	req := openai.ChatCompletionRequest{
		Model: modelVersion,
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleUser,
				Content: prompt,
			},
		},
	}

	// Only set temperature for models that support it
	if modelVersion != "o3" && modelVersion != "o4-mini" {
		req.Temperature = 0.7
	}

	// For o3 model, add a system message to prevent follow-up questions
	if model == "o3" {
		req.Messages = append([]openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: "You are a helpful assistant. Provide comprehensive answers without asking follow-up questions. Always complete your response in a single turn.",
			},
		}, req.Messages...)
	}

	// Call the API
	resp, err := client.CreateChatCompletion(context.Background(), req)
	if err != nil {
		return "", err
	}

	// Return the response text
	return resp.Choices[0].Message.Content, nil
}

// callGeminiAPI handles API calls to Google's Gemini models using the REST API
func callGeminiAPI(model string, prompt string, apiKey string) (string, error) {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Determine the appropriate model version string based on the model parameter
	var modelVersion string
	switch model {
	case "pro-2.5":
		modelVersion = "gemini-2.5-pro-exp-03-25"
	case "flash-2.5":
		modelVersion = "gemini-2.5-flash-preview-04-17"
	default:
		modelVersion = model // Use the provided model string directly if it doesn't match any known models
	}

	// Create the request URL
	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", modelVersion, apiKey)

	// Create the request body
	requestBody := map[string]interface{}{
		"contents": []map[string]interface{}{
			{
				"role": "user",
				"parts": []map[string]interface{}{
					{
						"text": prompt,
					},
				},
			},
		},
	}

	// Convert the request body to JSON
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("error marshaling request body: %w", err)
	}

	// Create the HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("error creating request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading response body: %w", err)
	}

	// Check for error status code
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: %s", string(body))
	}

	// Parse the response
	var responseData map[string]interface{}
	err = json.Unmarshal(body, &responseData)
	if err != nil {
		return "", fmt.Errorf("error parsing response: %w", err)
	}

	// Extract the text from the response
	candidates, ok := responseData["candidates"].([]interface{})
	if !ok || len(candidates) == 0 {
		return "", errors.New("no candidates in response")
	}

	content, ok := candidates[0].(map[string]interface{})["content"].(map[string]interface{})
	if !ok {
		return "", errors.New("no content in response")
	}

	parts, ok := content["parts"].([]interface{})
	if !ok || len(parts) == 0 {
		return "", errors.New("no parts in response")
	}

	text, ok := parts[0].(map[string]interface{})["text"].(string)
	if !ok {
		return "", errors.New("no text in response")
	}

	return text, nil
}

// callClaudeAPI handles API calls to Claude models using direct HTTP requests
func callClaudeAPI(model string, prompt string, apiKey string) (string, error) {
	// Create a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Create the request URL
	url := "https://api.anthropic.com/v1/messages"

	// Create the request body
	requestBody := map[string]interface{}{
		"model": model,
		"messages": []map[string]interface{}{
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens": 4000,
	}

	// Convert the request body to JSON
	jsonBody, err := json.Marshal(requestBody)
	if err != nil {
		return "", fmt.Errorf("error marshaling request body: %w", err)
	}

	// Create the HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", fmt.Errorf("error creating request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error sending request: %w", err)
	}
	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading response body: %w", err)
	}

	// Check for error status code
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: %s", string(body))
	}

	// Parse the response
	var responseData map[string]interface{}
	err = json.Unmarshal(body, &responseData)
	if err != nil {
		return "", fmt.Errorf("error parsing response: %w", err)
	}

	// Extract the text from the response
	content, ok := responseData["content"].([]interface{})
	if !ok || len(content) == 0 {
		return "", errors.New("no content in response")
	}

	firstContent, ok := content[0].(map[string]interface{})
	if !ok {
		return "", errors.New("invalid content format in response")
	}

	text, ok := firstContent["text"].(string)
	if !ok {
		return "", errors.New("no text in response")
	}

	return text, nil
}

// scrapeLambdaChat uses Playwright via Node.js to scrape responses from lambda.chat
func scrapeLambdaChat(prompt string, debug bool) (string, error) {
	startTime := time.Now()

	// Path to the Node.js script
	scriptPath := "./lambda_scraper/scrape.js"

	// Create the command to run the Node.js script with the prompt as an argument
	cmd := exec.Command("node", scriptPath, prompt)

	// Create pipes for stdout and stderr
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start Node.js script: %w", err)
	}

	// Read stderr in a goroutine and log it if debug is enabled
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			if debug {
				log.Println("[Playwright]", scanner.Text())
			}
		}
	}()

	// Read the response from stdout
	var responseBuffer bytes.Buffer
	if _, err := io.Copy(&responseBuffer, stdout); err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	// Wait for the command to complete
	if err := cmd.Wait(); err != nil {
		return "", fmt.Errorf("Node.js script execution failed: %w", err)
	}

	// Get the response text
	responseText := responseBuffer.String()

	// Log completion time if debug is enabled
	duration := time.Since(startTime)
	if debug {
		log.Printf("[Playwright] Scraping Lambda.Chat (DeepSeek R1 671b)... completed in %.2f seconds", duration.Seconds())
	}

	return responseText, nil
}
