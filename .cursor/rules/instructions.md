# Bruno API Client - Cursor AI Rules (YAML / OpenCollection Format)

## What is Bruno?
Bruno is an innovative API client that stores API collections directly in your filesystem. As of **Bruno v3.1**, the default format is **YAML** based on the [OpenCollection specification](https://spec.opencollection.com/). It's designed as a Git-first, offline-only alternative to Postman, perfect for teams who want to version control their API tests alongside their code.

> **Note**: For legacy Bru format rules, see `.cursorrules-bru`.

## Core Philosophy
- **Offline-First**: No cloud sync, everything stored locally
- **Git-Collaborative**: Collections designed for version control
- **YAML Format**: Human-readable `.yml` files (OpenCollection spec)
- **File-Based**: No databases, everything in the filesystem
- **Developer-Friendly**: Works with your existing workflow

## Collection Directory Structure
```
My Collection/
├── opencollection.yml             # Collection root file (REQUIRED)
├── collection.yml                 # Collection-level settings (optional)
├── environments/                  # Environment files directory
│   ├── Local.yml
│   └── Production.yml
├── Get User.yml                   # Individual request files
├── Create User.yml
└── Users/                         # Subfolder for organization
    ├── folder.yml
    └── Get User by ID.yml
```

### opencollection.yml Format
**ALWAYS include the `opencollection` version header** as the first line. Use the latest version from the [OpenCollection spec](https://spec.opencollection.com/) (currently `1.0.0`).

**Minimal `opencollection.yml`**:
```yaml
opencollection: 1.0.0

info:
  name: Your Collection Name
```

**Full `opencollection.yml`** with optional collection-level fields:
```yaml
opencollection: 1.0.0

info:
  name: Bruno Example
config:
  proxy:
    inherit: true
request:
  variables:
    - name: tokenVar
      value: tokenCollection
      disabled: true
  scripts:
    - type: before-request
      code: // console.log('Collection Level Script Logic')
docs:
  content: |-
    ### Markdown Docs
  type: text/markdown
```

**IMPORTANT**: `opencollection.yml` supports collection-level `info:`, `config:`, `request:` (variables/scripts), and `docs:`. **DO NOT** add request-specific keys like `http:` — those belong in individual request `.yml` files.

## YAML Request File Format (.yml)
```yaml
info:
  name: API Request Name
  type: http
  seq: 1

http:
  method: GET
  url: "{{baseUrl}}/api/endpoint"
  headers:
    - name: content-type
      value: application/json
    - name: authorization
      value: "Bearer {{token}}"
  body:
    type: json
    data: |-
      {
        "key": "value"
      }
  auth:
    type: bearer
    token: "{{authToken}}"

runtime:
  scripts:
    - type: before-request
      code: |-
        bru.setVar("timestamp", Date.now());
    - type: after-response
      code: |-
        bru.setVar("userId", res.body.id);
    - type: tests
      code: |-
        test("Status is 200", function() {
          expect(res.status).to.equal(200);
        });

settings:
  encodeUrl: true
```

## GraphQL Requests
```yaml
info:
  name: GetPokemon
  type: graphql
  seq: 2

http:
  method: POST
  url: "https://graphql-api.example.com/graphql"
  body:
    type: graphql
    data: |-
      query GetPokemon($name: String!) {
        pokemon(name: $name) {
          id
          name
          height
          weight
        }
      }
    variables: |-
      {
        "name": "pikachu"
      }
  auth:
    type: inherit

settings:
  encodeUrl: true
```

## File Structure
- `opencollection.yml` - Collection root file (REQUIRED — must include `opencollection` version header)
- `collection.yml` - Collection-level settings
- `folder.yml` - Folder-level settings
- `*.yml` - Request files
- `environments/*.yml` - Environment files

## Environment Files
```yaml
variables:
  - name: baseUrl
    value: https://api.example.com
  - name: apiVersion
    value: v1
  - name: apiKey
    value: ""
    secret: true
  - name: authToken
    value: ""
    secret: true
```

## JavaScript API Reference

### Request Object (req)
Available in pre-request and test scripts:
- `req.getUrl()` - Get the current request URL
- `req.setUrl(url)` - Set the request URL
- `req.getMethod()` - Get HTTP method (GET, POST, etc.)
- `req.setMethod(method)` - Set HTTP method
- `req.getHeader(name)` - Get a specific header
- `req.getHeaders()` - Get all headers
- `req.setHeader(name, value)` - Set a header
- `req.setHeaders(headers)` - Set multiple headers
- `req.getBody()` - Get request body
- `req.setBody(body)` - Set request body
- `req.setTimeout(ms)` - Set request timeout
- `req.setMaxRedirects(count)` - Set max redirects

### Response Object (res)
Available in post-response scripts and tests:
- `res.status` - HTTP status code
- `res.statusText` - HTTP status text
- `res.headers` - Response headers object
- `res.body` - Parsed response body
- `res.responseTime` - Response time in milliseconds
- `res.getHeader(name)` - Get specific response header
- `res.getStatus()` - Get status code
- `res.getBody()` - Get response body

### Bruno Runtime (bru)
Core scripting API:
- `bru.setVar(key, value)` - Set runtime variable
- `bru.getVar(key)` - Get runtime variable
- `bru.setEnvVar(key, value)` - Set environment variable
- `bru.getEnvVar(key)` - Get environment variable
- `bru.getProcessEnv(key)` - Get process environment variable
- `bru.setNextRequest(requestName)` - Chain to next request
- `bru.sleep(ms)` - Pause execution
- `bru.cwd()` - Get current working directory

### Dynamic Variables
Use in request URLs, headers, or body:
- `{{$guid}}` - Random GUID
- `{{$timestamp}}` - Current timestamp
- `{{$randomInt}}` - Random integer
- `{{$randomEmail}}` - Random email
- `{{$randomFirstName}}` - Random first name
- `{{$randomLastName}}` - Random last name
- `{{$randomFullName}}` - Random full name
- `{{$randomPhoneNumber}}` - Random phone number
- `{{$randomCity}}` - Random city name
- `{{$randomCountry}}` - Random country name

### Test Assertions (Chai.js)
```javascript
test("Status is 200", function() {
  expect(res.status).to.equal(200);
});

test("Response has data", function() {
  expect(res.body).to.have.property("data");
  expect(res.body.data).to.be.an("array");
});

test("Response time is acceptable", function() {
  expect(res.responseTime).to.be.below(2000);
});
```

### Cookie Management
```javascript
const jar = bru.cookies.jar();
jar.setCookie(url, "sessionId", "abc123");
jar.getCookie(url, "sessionId");
jar.deleteCookie(url, "sessionId");
```

## Best Practices
1. **Use YAML format** - Use `.yml` files for all API definitions (OpenCollection spec)
2. **Environment variables** - Use `{{variableName}}` for values that change across environments
3. **Secret management** - Use `secret: true` in environment files, not in version control
4. **Comprehensive tests** - Write tests for status codes, response structure, and data validation
5. **Request chaining** - Use `bru.setNextRequest()` for complex workflows
6. **Error handling** - Add validation in pre-request scripts
7. **Git-friendly** - Organize collections logically for version control
8. **Documentation** - Use meaningful names and add comments in scripts

## Common Mistakes
- ❌ Missing `opencollection.yml` — every collection MUST have one
- ❌ Using `meta:` instead of `info:` — use `info:` for request metadata
- ❌ Putting `http:` blocks in `opencollection.yml` — request details go in separate `.yml` files
- ❌ Using `test` instead of `tests` for script type
- ❌ Putting tests at root level — they belong under `runtime: scripts:`
- ❌ Using `.yaml` extension — Bruno uses `.yml`

## Common Use Cases
- API development and testing
- Integration testing for microservices
- Automated testing in CI/CD pipelines (using Bruno CLI)
- API documentation with examples
- Team collaboration on API collections
- Converting from Postman/Insomnia collections

## GitHub Actions CI/CD Integration

Bruno CLI integrates seamlessly with GitHub Actions to automate API testing workflows. GitHub Actions is a powerful continuous integration and continuous delivery (CI/CD) platform that enables you to automate your software development workflows directly from your GitHub repository.

### Prerequisites
- Git installed
- GitHub repository with Bruno collection
- Bruno collection properly organized in your repository

### Repository Structure

Ensure your Bruno collections are properly organized in your repository:

```
your-api-project/
├── .github/
│   └── workflows/
│       └── api-tests.yml
├── bruno-api-collection/
│   ├── opencollection.yml
│   ├── collection.yml
│   ├── environments/
│   │   ├── development.yml
│   │   ├── ci.yml
│   │   └── production.yml
│   └── api/
│       └── data/
│           ├── Get All Data.yml
│           ├── Create Data.yml
│           └── Update Data by ID.yml
└── server.js
```

### Setting Up GitHub Actions Workflow

1. **Create the workflow directory structure:**
```bash
mkdir -p .github/workflows
```

2. **Create a GitHub Actions workflow file** `.github/workflows/api-tests.yml`:

```yaml
name: API Tests

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install Bruno CLI
      run: npm install -g @usebruno/cli
    
    - name: Run API Tests
      run: bru run --env ci --reporter-html results.html
    
    - name: Upload Test Results
      uses: actions/upload-artifact@v4
      with:
        name: test-results
        path: results.html
```

### Workflow Configuration Explained

- **`name`**: The name of the workflow that appears in the GitHub Actions tab
- **`on`**: Defines when the workflow should run
  - `push`: Triggers on pushes to specified branches
  - `pull_request`: Triggers on pull requests to specified branches
- **`jobs.test`**: Defines a job named "test"
  - `runs-on`: The GitHub-hosted runner to use (e.g., `ubuntu-latest`)
- **`steps`**: The sequence of steps to execute
  - **Checkout code**: Checks out the repository code
  - **Setup Node.js**: Sets up Node.js environment (required for Bruno CLI)
  - **Install Bruno CLI**: Installs Bruno CLI globally using npm
  - **Run API Tests**: Executes Bruno tests with specified environment and HTML reporter
  - **Upload Test Results**: Uploads test results as artifacts for download

### Bruno CLI Command Options

The `bru run` command supports various options:

- `--env <environment>`: Specify the environment to use (e.g., `ci`, `development`, `production`)
- `--reporter-html <file>`: Generate HTML test report
- `--reporter-json <file>`: Generate JSON test report
- `--reporter-junit <file>`: Generate JUnit XML report (useful for CI/CD)
- `--collection <path>`: Specify collection path (if not in current directory)

### Advanced Workflow Examples

#### Running Tests with Multiple Environments

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [development, staging, production]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install Bruno CLI
      run: npm install -g @usebruno/cli
    
    - name: Run API Tests - ${{ matrix.environment }}
      run: bru run --env ${{ matrix.environment }} --reporter-junit results-${{ matrix.environment }}.xml
    
    - name: Upload Test Results
      uses: actions/upload-artifact@v4
      with:
        name: test-results-${{ matrix.environment }}
        path: results-${{ matrix.environment }}.xml
```

#### Running Tests with Server Startup

If your API server needs to be running during tests:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: npm install
    
    - name: Start API server
      run: npm start &
      env:
        PORT: 3000
        NODE_ENV: test
    
    - name: Wait for server
      run: |
        timeout 30 bash -c 'until curl -f http://localhost:3000; do sleep 1; done'
    
    - name: Install Bruno CLI
      run: npm install -g @usebruno/cli
    
    - name: Run API Tests
      run: bru run --env ci --reporter-html results.html
    
    - name: Upload Test Results
      uses: actions/upload-artifact@v4
      with:
        name: test-results
        path: results.html
```

#### Using Secrets in CI Environment

Store sensitive values as GitHub Secrets and reference them in your workflow:

```yaml
- name: Run API Tests
  run: bru run --env ci --reporter-html results.html
  env:
    API_KEY: ${{ secrets.API_KEY }}
    API_SECRET: ${{ secrets.API_SECRET }}
```

Then access them in your Bruno scripts using `bru.getProcessEnv()`:

```javascript
// In a pre-request script (runtime.scripts type: before-request)
const apiKey = bru.getProcessEnv("API_KEY");
req.setHeader("Authorization", `Bearer ${apiKey}`);
```

### Monitoring and Viewing Results

1. **Monitor the workflow:**
   - Go to your GitHub repository
   - Click on the "Actions" tab
   - You should see your workflow running

2. **View results:**
   - Once completed, download the test results from the artifacts section
   - Open `results.html` in your browser for detailed reports
   - Check the workflow logs for any failures

### Best Practices for GitHub Actions Integration

1. **Environment-specific configurations**: Create separate environment files for CI/CD (e.g., `ci.yml`, `staging.yml`, `production.yml`)
2. **Test isolation**: Ensure tests are independent and can run in any order
3. **Error handling**: Use proper error handling in test scripts to avoid false positives
4. **Secret management**: Use GitHub Secrets for sensitive data instead of hardcoding
5. **Parallel execution**: Use matrix strategies to run tests across multiple environments
6. **Artifact retention**: Configure artifact retention policies to manage storage
7. **Notifications**: Set up notifications for test failures (email, Slack, etc.)

### Additional Resources

- [Bruno CLI Documentation](https://docs.usebruno.com/bru-cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Bruno GitHub Actions Examples](https://docs.usebruno.com/bru-cli/gitHubCLI)

For more advanced GitHub Actions features and configurations, visit the [GitHub Actions documentation](https://docs.github.com/en/actions).