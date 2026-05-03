import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () => {
  const base = ENV.forgeApiUrl?.trim();
  if (!base) return "https://forge.manus.im/v1/chat/completions";
  const cleaned = base.replace(/\/+$/, "");
  // If the URL already ends with /v1, just append /chat/completions
  if (cleaned.endsWith('/v1')) return `${cleaned}/chat/completions`;
  return `${cleaned}/v1/chat/completions`;
};

// ── 多 API Key 輪換機制 ──
// 從環境變數讀取多個 key: OPENAI_API_KEY, OPENAI_API_KEY_2, OPENAI_API_KEY_3
function getApiKeys(): string[] {
  const keys: string[] = [];
  if (ENV.forgeApiKey) keys.push(ENV.forgeApiKey);
  const key2 = process.env.OPENAI_API_KEY_2?.trim();
  const key3 = process.env.OPENAI_API_KEY_3?.trim();
  if (key2) keys.push(key2);
  if (key3) keys.push(key3);
  return keys;
}

// 啟動時記錄可用 key 數量
const _initKeys = getApiKeys();
console.log(`[LLM] 已載入 ${_initKeys.length} 個 API Key (${_initKeys.map((k, i) => `key${i+1}: ${k.substring(0,10)}...`).join(', ')})`);

let currentKeyIndex = 0;

function getNextApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("OPENAI_API_KEY is not configured");
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return keys[currentKeyIndex];
}

function getCurrentApiKey(): string {
  const keys = getApiKeys();
  if (keys.length === 0) throw new Error("OPENAI_API_KEY is not configured");
  return keys[currentKeyIndex % keys.length];
}

const assertApiKey = () => {
  if (getApiKeys().length === 0) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  // ── 多模型 fallback 機制 ──
  // 主模型不可用時自動降級到備用模型
  const isGenSparkProxy = ENV.forgeApiUrl?.includes('genspark.ai');
  const modelCandidates = isGenSparkProxy
    ? ["gpt-5-mini"]
    : ["gemini-2.5-flash", "gemini-2.5-pro", "gpt-5-mini", "claude-sonnet-4-6"];

  const normalizedMessages = messages.map(normalizeMessage);

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  let lastError = '';

  for (const model of modelCandidates) {
    const payload: Record<string, unknown> = {
      model,
      messages: normalizedMessages,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }
    if (normalizedToolChoice) {
      payload.tool_choice = normalizedToolChoice;
    }
    if (normalizedResponseFormat) {
      payload.response_format = normalizedResponseFormat;
    }

    const apiKeys = getApiKeys();
    const attemptsPerModel = apiKeys.length * 2; // 每個 key 最多試 2 次
    const RETRY_DELAY = 2000;
    let modelAllFailed503 = true; // 追蹤是否全部都是 503/429/403

    for (let attempt = 0; attempt < attemptsPerModel; attempt++) {
      const apiKey = getCurrentApiKey();
      const keyLabel = `key${(currentKeyIndex % apiKeys.length) + 1}/${apiKeys.length}`;

      try {
        const response = await fetch(resolveApiUrl(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          if (model !== modelCandidates[0]) {
            console.log(`[LLM] 使用備用模型 ${model} 成功 (${keyLabel}, attempt ${attempt + 1})`);
          } else if (attempt > 0) {
            console.log(`[LLM] 成功 (${model}, ${keyLabel}, attempt ${attempt + 1})`);
          }
          return (await response.json()) as InvokeResult;
        }

        const errorText = await response.text();
        lastError = `${response.status} ${response.statusText} – ${errorText}`;

        // 429 (rate limit) / 503 (overloaded) / 403 (quota) → 切換到下一個 key
        if (response.status === 429 || response.status === 503 || response.status === 403) {
          console.warn(`[LLM] ${model} ${keyLabel} → ${response.status}, 切換下一個 key...`);
          getNextApiKey();
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          continue;
        }

        // 其他錯誤（如 400 Bad Request）可能是模型不支援某些參數
        // 嘗試下一個模型
        modelAllFailed503 = false;
        console.warn(`[LLM] ${model} → ${response.status}, 嘗試下一個模型...`);
        break;

      } catch (networkErr: any) {
        lastError = `Network error: ${networkErr.message}`;
        console.warn(`[LLM] ${model} ${keyLabel} 網路錯誤: ${networkErr.message}`);
        getNextApiKey();
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        continue;
      }
    }

    // 該模型所有 key 都試完了，嘗試下一個模型
    if (modelCandidates.indexOf(model) < modelCandidates.length - 1) {
      console.warn(`[LLM] 模型 ${model} 所有嘗試失敗，降級到下一個備用模型...`);
    }
  }

  throw new Error(`LLM invoke failed after trying all models [${modelCandidates.join(', ')}]: ${lastError}`);
}
