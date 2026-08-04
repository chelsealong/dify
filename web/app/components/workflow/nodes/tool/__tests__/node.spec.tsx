import type { ToolNodeType } from '../types'
import { render, screen } from '@testing-library/react'
import { useNodes } from 'reactflow'
import { FormTypeEnum } from '@/app/components/header/account-setting/model-provider-page/declarations'
import { CollectionType } from '@/app/components/tools/types'
import { BlockEnum } from '@/app/components/workflow/types'
import Node from '../node'

const mockUseNodePluginInstallation = vi.hoisted(() => vi.fn())
const mockUseCurrentToolCollection = vi.hoisted(() => vi.fn())

vi.mock('../../../hooks/use-node-plugin-installation', () => ({
  useNodePluginInstallation: mockUseNodePluginInstallation,
}))

vi.mock('../hooks/use-current-tool-collection', () => ({
  __esModule: true,
  default: mockUseCurrentToolCollection,
}))

vi.mock('@/app/components/workflow/nodes/_base/components/install-plugin-button', () => ({
  InstallPluginButton: () => <button type="button">Install Plugin</button>,
}))

vi.mock('reactflow', async () => {
  const actual = await vi.importActual<typeof import('reactflow')>('reactflow')
  return {
    ...actual,
    useNodes: vi.fn(),
  }
})

const mockUseNodes = vi.mocked(useNodes)

const createNodeData = (overrides: Partial<ToolNodeType> = {}): ToolNodeType => ({
  title: 'Google Search',
  desc: '',
  type: BlockEnum.Tool,
  provider_id: 'google_search',
  provider_type: CollectionType.builtIn,
  provider_name: 'Google Search',
  tool_name: 'google_search',
  tool_label: 'Google Search',
  tool_parameters: {},
  tool_configurations: {},
  ...overrides,
})

describe('ToolNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNodePluginInstallation.mockReturnValue({
      isChecking: false,
      isMissing: false,
      uniqueIdentifier: undefined,
      canInstall: false,
      onInstallSuccess: vi.fn(),
      shouldDim: false,
    })
    mockUseCurrentToolCollection.mockReturnValue({
      currentTools: [],
      currCollection: undefined,
    })
    mockUseNodes.mockReturnValue([
      {
        id: 'upstream-node-1',
        data: {
          title: 'File Upload',
          type: BlockEnum.Start,
        },
      },
    ] as ReturnType<typeof useNodes>)
  })

  describe('Authorization Warning', () => {
    it('should render the authorization warning when the tool requires authorization and is not authorized', () => {
      mockUseCurrentToolCollection.mockReturnValue({
        currentTools: [],
        currCollection: {
          allow_delete: true,
          is_team_authorization: false,
        },
      })

      render(<Node id="tool-node-1" data={createNodeData()} />)

      expect(screen.getByText('workflow.nodes.tool.authorizationRequired')).toBeInTheDocument()
    })

    it('should keep configuration rows visible when the authorization warning is shown', () => {
      mockUseCurrentToolCollection.mockReturnValue({
        currentTools: [],
        currCollection: {
          allow_delete: true,
          is_team_authorization: false,
        },
      })

      render(
        <Node
          id="tool-node-1"
          data={createNodeData({
            tool_configurations: {
              region: { value: 'us' },
            },
          })}
        />,
      )

      expect(screen.getByText('region')).toBeInTheDocument()
      expect(screen.getByText('workflow.nodes.tool.authorizationRequired')).toBeInTheDocument()
    })

    it('should render nothing when there are no configs, no install action and no authorization warning', () => {
      const { container } = render(<Node id="tool-node-1" data={createNodeData()} />)

      expect(container).toBeEmptyDOMElement()
    })
  })

  it('should render multi-select configuration values', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          tool_configurations: {
            formats: { type: 'constant', value: ['png', 'svg'] },
          },
        })}
      />,
    )

    expect(screen.getByTitle('png, svg')).toHaveTextContent('png, svg')
  })

  it('should resolve a variable-reference value to the upstream node title instead of showing the raw node id', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          tool_configurations: {
            input_file: { type: 'variable', value: ['upstream-node-1', 'file'] },
          },
        })}
      />,
    )

    expect(screen.queryByText('upstream-node-1, file')).not.toBeInTheDocument()
    expect(screen.getByText('File Upload')).toBeInTheDocument()
    expect(screen.getByText('file')).toBeInTheDocument()
  })

  it('should render the model name for a model-selector configuration value', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          paramSchemas: [{ name: 'model', type: FormTypeEnum.modelSelector }],
          tool_configurations: {
            model: {
              type: 'constant',
              value: {
                provider: 'langgenius/openai/openai',
                model: 'gemma4-31b',
                model_type: 'llm',
                mode: 'chat',
                completion_params: {},
              },
            },
          },
        })}
      />,
    )

    expect(screen.getByTitle('gemma4-31b')).toHaveTextContent('gemma4-31b')
  })

  it('should not treat an unrelated object parameter with a "model" key as a model-selector value', () => {
    render(
      <Node
        id="tool-node-1"
        data={createNodeData({
          paramSchemas: [{ name: 'config', type: FormTypeEnum.object }],
          tool_configurations: {
            config: {
              type: 'constant',
              value: { model: { name: 'foo', version: 2 }, other: 'bar' },
            },
          },
        })}
      />,
    )

    expect(screen.getByText('config')).toBeInTheDocument()
    expect(screen.queryByTitle('foo')).not.toBeInTheDocument()
  })
})
