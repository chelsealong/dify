import type { FC } from 'react'
import type { ToolNodeType } from './types'
import type { Node, NodeProps } from '@/app/components/workflow/types'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useNodes } from 'reactflow'
import { FormTypeEnum } from '@/app/components/header/account-setting/model-provider-page/declarations'
import { InstallPluginButton } from '@/app/components/workflow/nodes/_base/components/install-plugin-button'
import { isSystemVar } from '@/app/components/workflow/nodes/_base/components/variable/utils'
import { VariableLabelInNode } from '@/app/components/workflow/nodes/_base/components/variable/variable-label'
import { VarKindType } from '@/app/components/workflow/nodes/_base/types'
import { BlockEnum } from '@/app/components/workflow/types'
import { useNodePluginInstallation } from '../../hooks/use-node-plugin-installation'
import { isToolAuthorizationRequired } from './auth'
import useCurrentToolCollection from './hooks/use-current-tool-collection'

const Node: FC<NodeProps<ToolNodeType>> = ({ data }) => {
  const { t } = useTranslation()
  const { tool_configurations, paramSchemas } = data
  const toolConfigs = Object.keys(tool_configurations || {})
  const nodes: Node[] = useNodes()
  const { isChecking, isMissing, uniqueIdentifier, canInstall, onInstallSuccess, shouldDim } =
    useNodePluginInstallation(data)
  const { currCollection } = useCurrentToolCollection(data.provider_type, data.provider_id)
  const showInstallButton = !isChecking && isMissing && canInstall && uniqueIdentifier
  const showAuthorizationWarning = isToolAuthorizationRequired(data.provider_type, currCollection)

  const hasConfigs = toolConfigs.length > 0

  if (!showInstallButton && !hasConfigs && !showAuthorizationWarning) return null

  return (
    <div className="relative mb-1 px-3 py-1">
      {showInstallButton && (
        <div className="pointer-events-auto absolute -top-8 right-3 z-40">
          <InstallPluginButton
            size="small"
            className="font-medium! text-text-accent!"
            extraIdentifiers={
              [data.plugin_id, data.provider_id, data.provider_name].filter(Boolean) as string[]
            }
            uniqueIdentifier={uniqueIdentifier!}
            onSuccess={onInstallSuccess}
          />
        </div>
      )}
      {(hasConfigs || showAuthorizationWarning) && (
        <div className="space-y-0.5" aria-disabled={shouldDim}>
          {hasConfigs &&
            toolConfigs.map((key) => {
              const config = tool_configurations[key]
              const value = config?.value
              const isVariableSelector =
                config?.type === VarKindType.variable && Array.isArray(value)
              const isModelValue =
                !!value &&
                typeof value === 'object' &&
                !Array.isArray(value) &&
                paramSchemas?.find((i) => i.name === key)?.type === FormTypeEnum.modelSelector

              let node: Node | undefined
              if (isVariableSelector) {
                const isSystem = isSystemVar(value)
                node = isSystem
                  ? nodes.find((n) => n.data.type === BlockEnum.Start)
                  : nodes.find((n) => n.id === value[0])
              }

              return (
                <div
                  key={key}
                  className="flex h-6 items-center justify-between space-x-1 rounded-md bg-workflow-block-parma-bg px-1 text-xs font-normal text-text-secondary"
                >
                  <div
                    title={key}
                    className="max-w-25 shrink-0 truncate text-xs font-medium text-text-tertiary uppercase"
                  >
                    {key}
                  </div>
                  {typeof value === 'string' && (
                    <div
                      title={value}
                      className="w-0 shrink-0 grow truncate text-right text-xs font-normal text-text-secondary"
                    >
                      {paramSchemas?.find((i) => i.name === key)?.type === FormTypeEnum.secretInput
                        ? '********'
                        : value}
                    </div>
                  )}
                  {typeof value === 'number' && (
                    <div
                      title={Number.isNaN(value) ? '' : String(value)}
                      className="w-0 shrink-0 grow truncate text-right text-xs font-normal text-text-secondary"
                    >
                      {Number.isNaN(value) ? '' : value}
                    </div>
                  )}
                  {isVariableSelector && (
                    <div className="w-0 shrink-0 grow">
                      <VariableLabelInNode
                        variables={value}
                        nodeType={node?.data.type}
                        nodeTitle={node?.data.title}
                      />
                    </div>
                  )}
                  {Array.isArray(value) && !isVariableSelector && (
                    <div
                      title={value.join(', ')}
                      className="w-0 shrink-0 grow truncate text-right text-xs font-normal text-text-secondary"
                    >
                      {value.join(', ')}
                    </div>
                  )}
                  {isModelValue && (
                    <div
                      title={value.model}
                      className="w-0 shrink-0 grow truncate text-right text-xs font-normal text-text-secondary"
                    >
                      {value.model}
                    </div>
                  )}
                </div>
              )
            })}
          {showAuthorizationWarning && (
            <div className="flex h-6 items-center rounded-md border-[0.5px] border-state-warning-active bg-state-warning-hover px-1.5">
              <span className="mr-1 size-1 shrink-0 rounded-xs bg-text-warning-secondary" />
              <div
                className="grow truncate system-xs-medium text-text-warning"
                title={t(($) => $['nodes.tool.authorizationRequired'], { ns: 'workflow' })}
              >
                {t(($) => $['nodes.tool.authorizationRequired'], { ns: 'workflow' })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(Node)
