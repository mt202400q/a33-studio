import { DEFAULT_ASSISTANT_SETTINGS } from '@shared/data/types/assistant'

/** Fixed id so the sidebar shortcut and A33AutoSetup can address the seeded assistant. */
export const A33_IMAGE_ASSISTANT_ID = '0a3c5b0b-28e1-499b-8377-6be491002277'

export function getA33ImageAssistantNameForLocale(locale?: string | null): string {
  return locale?.toLowerCase().startsWith('zh') ? '生图' : 'Image'
}

const A33_IMAGE_ASSISTANT_PROMPT = `你是 A33 生图助手，帮助用户通过对话连续生成和修改图片。

规则：
- 用户描述想要的画面时，调用 generate_image 工具生成图片。把用户的描述扩写成具体、完整的英文提示词（主体、风格、构图、光线、色彩），不要省略用户提到的任何细节。
- 用户要求修改、调整、换风格、换背景、"再来一张类似的"时，把上一张（或用户指定的那张）生成图片的 id 放进 image_ids，以编辑模式在原图基础上修改；只有用户明确要求重新画时才生成全新的图。
- 用户上传了参考图时，把参考图放进 image_ids。
- 生成后用一两句中文简短说明画了什么、可以怎么继续调整，不要复述提示词。
- 不要拒绝普通的创作请求；遇到需求不明确时，先按最合理的理解生成，再询问是否需要调整。`

export const A33_IMAGE_ASSISTANT_SEED = {
  id: A33_IMAGE_ASSISTANT_ID,
  emoji: '🎨',
  prompt: A33_IMAGE_ASSISTANT_PROMPT,
  description: '',
  modelId: null,
  settings: { ...DEFAULT_ASSISTANT_SETTINGS, enableGenerateImage: true }
} as const
