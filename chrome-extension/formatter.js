// Formatter functions ported from the CLI tool

function isJSONRequest(entry) {
  const contentType = entry.request?.postData?.mimeType || 
    entry.request?.headers?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
  return contentType.includes('application/json');
}

function isJSONResponse(entry) {
  return entry.response?.content?.mimeType?.includes('application/json') || false;
}

function isGraphQLRequest(entry) {
  if (!isJSONRequest(entry)) return false;
  
  const postData = entry.request?.postData?.text;
  if (!postData) return false;
  
  try {
    const parsed = JSON.parse(postData);
    return !!(parsed.operationName || parsed.query);
  } catch {
    return false;
  }
}

function filterJSONAndGraphQLEntries(entries) {
  return entries.filter(entry => 
    (isJSONRequest(entry) || isJSONResponse(entry)) && 
    entry.response?.content?.text !== undefined
  );
}

function formatEntry(entry, index) {
  const requestBody = parseJSONSafely(entry.request?.postData?.text);
  const responseBody = parseJSONSafely(entry.response?.content?.text);
  
  const isGraphQL = !!(requestBody?.operationName || requestBody?.query);
  
  return {
    index: index + 1,
    timestamp: entry.startedDateTime,
    duration: Math.round(entry.time),
    method: entry.request.method,
    url: entry.request.url,
    status: entry.response.status,
    requestBody,
    responseBody,
    isGraphQL,
    operationName: requestBody?.operationName
  };
}

function parseJSONSafely(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatForLLM(entries) {
  const formatted = entries.map((entry, index) => formatEntry(entry, index));
  const sections = [];
  
  sections.push(`<api_requests total="${formatted.length}" graphql="${formatted.filter(e => e.isGraphQL).length}" rest="${formatted.filter(e => !e.isGraphQL).length}">`);
  
  formatted.forEach(entry => {
    const type = entry.isGraphQL ? 'graphql' : 'rest';
    sections.push(`\n<request index="${entry.index}" type="${type}">`);
    sections.push(`  <url method="${entry.method}">${entry.url}</url>`);
    sections.push(`  <status code="${entry.status}" duration="${entry.duration}ms"/>`);
    
    if (entry.isGraphQL && entry.operationName) {
      sections.push(`  <operation>${entry.operationName}</operation>`);
    }
    
    if (entry.isGraphQL && entry.requestBody?.query) {
      sections.push(`  <graphql_query>`);
      sections.push(entry.requestBody.query);
      sections.push(`  </graphql_query>`);
      
      if (entry.requestBody.variables && Object.keys(entry.requestBody.variables).length > 0) {
        sections.push(`  <variables>`);
        sections.push(JSON.stringify(entry.requestBody.variables, null, 2));
        sections.push(`  </variables>`);
      }
    } else if (entry.requestBody) {
      sections.push(`  <request_body>`);
      sections.push(JSON.stringify(entry.requestBody, null, 2));
      sections.push(`  </request_body>`);
    }
    
    if (entry.responseBody) {
      sections.push(`  <response>`);
      const responseStr = JSON.stringify(entry.responseBody, null, 2);
      if (responseStr.length > 1000) {
        sections.push(responseStr.substring(0, 1000) + "\n... [truncated]");
      } else {
        sections.push(responseStr);
      }
      sections.push(`  </response>`);
    }
    
    sections.push(`</request>`);
  });
  
  sections.push(`\n</api_requests>`);
  
  return sections.join('\n');
}

