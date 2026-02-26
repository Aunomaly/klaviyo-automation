import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

interface ExtractedImage {
  url: string
  type: string
  width: number | null
  height: number | null
  alt: string | null
  context: string | null
}

interface ScrapeResult {
  name: string
  website_url: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  font_primary: string
  font_secondary: string
  logo_url: string | null
  favicon_url: string | null
  tagline: string | null
  images: ExtractedImage[]
  extraction_success: boolean
  extraction_errors: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Run Python scraper
    const result = await runPythonScraper(url)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: 'Failed to scrape website', details: String(error) },
      { status: 500 }
    )
  }
}

function runPythonScraper(url: string): Promise<ScrapeResult> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'lib', 'scraper', 'scraper.py')
    
    // Use venv Python if available, otherwise fall back to system python3
    const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python')
    const python = spawn(venvPython, [scriptPath, url])
    
    let stdout = ''
    let stderr = ''
    
    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    python.on('close', (code) => {
      if (code !== 0) {
        // If Python script fails, return a fallback response
        console.error('Python script error:', stderr)
        resolve({
          name: extractDomainName(url),
          website_url: url,
          primary_color: '#000000',
          secondary_color: '#FFFFFF',
          accent_color: '#666666',
          font_primary: 'Helvetica, Arial, sans-serif',
          font_secondary: 'Georgia, serif',
          logo_url: null,
          favicon_url: `${url}/favicon.ico`,
          tagline: null,
          images: [],
          extraction_success: false,
          extraction_errors: ['Python scraper failed: ' + stderr.substring(0, 200)]
        })
        return
      }
      
      try {
        // Parse JSON from stdout (between --- Results --- and --- Summary ---)
        const jsonMatch = stdout.match(/--- Results ---\n([\s\S]*?)\n--- Summary ---/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[1])
          resolve(result)
        } else {
          // Try to parse entire stdout as JSON
          const result = JSON.parse(stdout)
          resolve(result)
        }
      } catch (parseError) {
        console.error('Failed to parse scraper output:', parseError)
        resolve({
          name: extractDomainName(url),
          website_url: url,
          primary_color: '#000000',
          secondary_color: '#FFFFFF',
          accent_color: '#666666',
          font_primary: 'Helvetica, Arial, sans-serif',
          font_secondary: 'Georgia, serif',
          logo_url: null,
          favicon_url: null,
          tagline: null,
          images: [],
          extraction_success: false,
          extraction_errors: ['Failed to parse scraper output']
        })
      }
    })
    
    // Timeout after 60 seconds
    setTimeout(() => {
      python.kill()
      reject(new Error('Scraper timed out'))
    }, 60000)
  })
}

function extractDomainName(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = parsed.hostname.replace('www.', '')
    const name = hostname.split('.')[0]
    return name.charAt(0).toUpperCase() + name.slice(1)
  } catch {
    return 'Unknown Brand'
  }
}
