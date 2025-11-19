/**
 * Manus AI API Client
 * Handles file uploads, task creation, and status checking
 */

const MANUS_API_BASE_URL = 'https://api.manus.ai';
const MANUS_API_KEY = process.env.MANUS_API_KEY;

// Only log warning if API key is missing (not on every module load)
if (!MANUS_API_KEY) {
  console.warn('[Manus AI] MANUS_API_KEY environment variable is not set');
}

interface ManusFileUploadResponse {
  file_id: string;
  upload_url: string;
  filename: string;
}

interface ManusTaskResponse {
  task_id: string;
  task_title: string;
  task_url: string;
}

interface ManusTaskStatus {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  output?: any; // Alternative result field
  data?: any;   // Alternative result field
  content?: any; // Alternative result field
  error?: string;
}

/**
 * Upload a file to Manus AI
 * Returns file_id for use in task attachments
 */
export async function uploadFileToManus(
  fileBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  if (!MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY is not configured');
  }

  try {
    // Step 1: Get presigned URL
    const fileRequestResponse = await fetch(`${MANUS_API_BASE_URL}/v1/files`, {
      method: 'POST',
      headers: {
        'API_KEY': MANUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: filename,
      }),
    });

    if (!fileRequestResponse.ok) {
      const errorText = await fileRequestResponse.text();
      throw new Error(`Failed to get presigned URL: ${fileRequestResponse.status} ${errorText}`);
    }

    const fileData: ManusFileUploadResponse = await fileRequestResponse.json();
    const { file_id, upload_url } = fileData;

    // Step 2: Upload file to presigned URL
    // Convert Buffer to Uint8Array for fetch (Node.js compatibility)
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${errorText}`);
    }

    return file_id;
  } catch (error) {
    console.error('[Manus AI] Error uploading file:', error);
    throw error;
  }
}

/**
 * Create a Manus AI task
 */
export async function createManusTask(
  prompt: string,
  fileIds: string[] = [],
  options: {
    agentProfile?: string;
    taskMode?: 'agent' | 'chat' | 'adaptive';
    hideInTaskList?: boolean;
    createShareableLink?: boolean;
    taskId?: string; // Use existing task ID to continue conversation
  } = {}
): Promise<ManusTaskResponse> {
  if (!MANUS_API_KEY) {
    console.error('[Manus AI] MANUS_API_KEY is not set in environment variables');
    throw new Error('MANUS_API_KEY is not configured. Please add it to .env and restart the server.');
  }

  try {
    const requestBody: any = {
      prompt: prompt,
      agentProfile: options.agentProfile || 'manus-1.5',
      ...options,
    };

    // Add attachments if files were uploaded (only for new tasks, not continuations)
    // Filter out any empty or invalid file_ids
    const validFileIds = fileIds.filter(id => id && typeof id === 'string' && id.trim().length > 0);

    if (validFileIds.length > 0 && !options.taskId) {
      // Format: array of objects with file_id property
      requestBody.attachments = validFileIds.map(file_id => ({ file_id }));
    }

    // If taskId is provided, this continues an existing task
    if (options.taskId) {
      requestBody.taskId = options.taskId;
    }

    const response = await fetch(`${MANUS_API_BASE_URL}/v1/tasks`, {
      method: 'POST',
      headers: {
        'API_KEY': MANUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Manus AI] Failed to create task:', response.status, errorText);
      throw new Error(`Failed to create Manus task: ${response.status} ${errorText}`);
    }

    const taskData: ManusTaskResponse = await response.json();
    return taskData;
  } catch (error) {
    console.error('[Manus AI] Error creating task:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Continue an existing Manus task with a new prompt
 * This maintains context from previous phases
 */
export async function continueManusTask(
  taskId: string,
  prompt: string
): Promise<ManusTaskResponse> {
  return createManusTask(prompt, [], {
    taskId: taskId,
    agentProfile: 'manus-1.5',
    taskMode: 'agent',
  });
}

/**
 * Get task status from Manus AI
 */
export async function getManusTaskStatus(taskId: string): Promise<ManusTaskStatus> {
  if (!MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${MANUS_API_BASE_URL}/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'API_KEY': MANUS_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get task status: ${response.status} ${errorText}`);
    }

    const taskStatus: ManusTaskStatus = await response.json();
    return taskStatus;
  } catch (error) {
    console.error('[Manus AI] Error getting task status:', error);
    throw error;
  }
}

/**
 * Register a webhook for Manus task updates
 */
export async function registerManusWebhook(
  webhookUrl: string,
  events: string[] = ['task.completed', 'task.failed']
): Promise<void> {
  if (!MANUS_API_KEY) {
    throw new Error('MANUS_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${MANUS_API_BASE_URL}/v1/webhooks`, {
      method: 'POST',
      headers: {
        'API_KEY': MANUS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          events: events,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register webhook: ${response.status} ${errorText}`);
    }

    console.log('[Manus AI] Webhook registered:', webhookUrl);
  } catch (error) {
    console.error('[Manus AI] Error registering webhook:', error);
    throw error;
  }
}

