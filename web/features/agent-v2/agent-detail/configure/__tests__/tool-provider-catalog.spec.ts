import type { ToolWithProvider } from '@/app/components/workflow/types'
import { describe, expect, it } from 'vitest'
import { CollectionType } from '@/app/components/tools/types'
import { getProviderCredentialType } from '../tool-provider-catalog'

const createProvider = (overrides: Partial<ToolWithProvider> = {}): ToolWithProvider =>
  ({
    id: 'tapd-server-test',
    name: 'tapd-server-test',
    author: 'test',
    description: { en_US: '', zh_Hans: '' },
    icon: '',
    label: { en_US: '', zh_Hans: '' },
    type: CollectionType.mcp,
    team_credentials: {},
    is_team_authorization: true,
    allow_delete: true,
    labels: [],
    tools: [],
    ...overrides,
  }) as ToolWithProvider

describe('getProviderCredentialType', () => {
  it('returns undefined for an authorized MCP provider even when team_credentials is populated', () => {
    const provider = createProvider({
      type: CollectionType.mcp,
      team_credentials: { server_url: 'https://example.com' },
    })

    expect(getProviderCredentialType(provider)).toBeUndefined()
  })

  it('still returns api-key for a builtin provider with team_credentials', () => {
    const provider = createProvider({
      type: CollectionType.builtIn,
      team_credentials: { api_key: 'secret' },
    })

    expect(getProviderCredentialType(provider)).toBe('api-key')
  })
})
