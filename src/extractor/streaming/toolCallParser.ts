import yaml from 'js-yaml';
import { z } from 'zod';

/**
 * Robustly parse a tool/function call payload from a string.
 * Supports JSON, XML, YAML, or auto-detection.
 * Throws on error.
 */
export function parseToolCallPayload(str: string, format: 'json' | 'xml' | 'yaml' | 'auto' = 'auto'): any {
  str = stripMarkdownCodeBlock(str.trim());
  if (format === 'json') {
    return tryParseJson(str);
  } else if (format === 'yaml') {
    return yaml.load(str);
  } else if (format === 'xml') {
    return parseXml(str);
  } else if (format === 'auto') {
    // Try JSON first
    try {
      return tryParseJson(str);
    } catch {}
    // Try YAML
    try {
      return yaml.load(str);
    } catch {}
    // Try XML
    try {
      return parseXml(str);
    } catch {}
    throw new Error('Could not parse tool/function call payload as JSON, YAML, or XML.');
  } else {
    throw new Error(`Unknown format: ${format}`);
  }
}

function tryParseJson(str: string): any {
  // Try direct parse
  try {
    return JSON.parse(str);
  } catch {}
  // Try to extract JSON substring
  const match = str.match(/({[\s\S]*})/);
  if (match) {
    return JSON.parse(match[1]);
  }
  throw new Error('Malformed JSON in tool/function call payload.');
}

function parseXml(str: string): any {
  // Very basic XML to JS object (for demo; use a real parser in production)
  // Only supports <function_call><name>...</name><arguments>...</arguments></function_call>
  const nameMatch = str.match(/<name>([\s\S]*?)<\/name>/);
  const argsMatch = str.match(/<arguments>([\s\S]*?)<\/arguments>/);
  if (!nameMatch) throw new Error('No <name> in XML payload.');
  let args: any = argsMatch ? argsMatch[1].trim() : '{}';
  // Try to parse arguments as JSON or YAML
  try {
    args = JSON.parse(args);
  } catch {
    try {
      args = yaml.load(args);
    } catch {
      args = args;
    }
  }
  return { name: nameMatch[1].trim(), arguments: args };
}

/**
 * Strips markdown code block markers (e.g., ```json ... ``` ) from a string.
 * Returns the inner content, or the original string if no code block is found.
 */
export function stripMarkdownCodeBlock(text: string): string {
  // Match ```lang\n ... \n``` or ```\n ... \n```
  const codeBlockRegex = /^```(?:\w+)?\n([\s\S]*?)\n```$/;
  const match = text.trim().match(codeBlockRegex);
  if (match) {
    return match[1].trim();
  }
  return text.trim();
} 