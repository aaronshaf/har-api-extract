export interface HAREntry {
  startedDateTime: string;
  time: number;
  request: {
    method: string;
    url: string;
    headers: Array<{ name: string; value: string }>;
    postData?: {
      mimeType: string;
      text: string;
    };
  };
  response: {
    status: number;
    statusText: string;
    headers: Array<{ name: string; value: string }>;
    content: {
      size: number;
      mimeType: string;
      text?: string;
    };
  };
}

export interface HAR {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HAREntry[];
  };
}

export interface CapturedRequest {
  requestId: string;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    timestamp: number;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
    timestamp: number;
    body?: string;
  };
  loadingFinished: boolean;
  failed?: boolean;
  errorText?: string;
}

export interface FormattedEntry {
  index: number;
  timestamp: string;
  duration: number;
  method: string;
  url: string;
  status: number;
  requestBody?: any;
  responseBody?: any;
  isGraphQL: boolean;
  operationName?: string;
}