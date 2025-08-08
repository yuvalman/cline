import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import React, { memo, useMemo } from "react"
import styled from "styled-components"
import { sapAiCoreModels } from "@shared/api"
import { SapAiCoreModelDeployment } from "@shared/proto/index.cline"

export const SAP_AI_CORE_MODEL_PICKER_Z_INDEX = 1_000

export interface SapAiCoreModelPickerProps {
	sapAiCoreModelDeployments: SapAiCoreModelDeployment[]
	selectedModelId: string
	onModelChange: (modelId: string, deploymentId: string) => void
	placeholder?: string
}

interface CategorizedModel {
	id: string
	isDeployed: boolean
	section: "deployed" | "supported"
}

const SapAiCoreModelPicker: React.FC<SapAiCoreModelPickerProps> = ({
	sapAiCoreModelDeployments,
	selectedModelId,
	onModelChange,
	placeholder = "Select a model...",
}) => {
	const handleModelChange = (e: any) => {
		const selectedValue = e.target.value

		if (!selectedValue) return

		// Find the deployment that matches the selected model
		const deployment = sapAiCoreModelDeployments.find((d) => d.modelName === selectedValue)
		if (deployment) {
			onModelChange(deployment.modelName, deployment.deploymentId)
		}
	}

	const categorizedModels = useMemo(() => {
		const allSupportedModels = Object.keys(sapAiCoreModels)

		// Models that are both deployed AND supported in Cline
		const deployedAndSupported = sapAiCoreModelDeployments.filter((deployment) =>
			allSupportedModels.includes(deployment.modelName),
		)

		// Models that are supported in Cline but NOT deployed
		const deployedModelNames = sapAiCoreModelDeployments.map((d) => d.modelName)
		const supportedButNotDeployed = allSupportedModels.filter(
			(supportedModel: string) => !deployedModelNames.includes(supportedModel),
		)

		const deployed: CategorizedModel[] = deployedAndSupported.map((deployment) => ({
			id: deployment.modelName,
			isDeployed: true,
			section: "deployed" as const,
		}))

		const supported: CategorizedModel[] = supportedButNotDeployed.map((id: string) => ({
			id,
			isDeployed: false,
			section: "supported" as const,
		}))

		return { deployed, supported }
	}, [sapAiCoreModelDeployments])

	const renderOptions = () => {
		const options: React.ReactNode[] = []

		// Add placeholder option
		options.push(
			<VSCodeOption key="placeholder" value="">
				{placeholder}
			</VSCodeOption>,
		)

		// Add deployed models section
		if (categorizedModels.deployed.length > 0) {
			// Add section separator (disabled option)
			options.push(
				<VSCodeOption key="deployed-header" value="" disabled>
					── Deployed Models ──
				</VSCodeOption>,
			)

			categorizedModels.deployed.forEach((model) => {
				options.push(
					<VSCodeOption key={model.id} value={model.id}>
						{model.id}
					</VSCodeOption>,
				)
			})
		}

		// Add supported but not deployed models section
		if (categorizedModels.supported.length > 0) {
			// Add section separator (disabled option)
			options.push(
				<VSCodeOption key="supported-header" value="" disabled>
					── Not Deployed Models ──
				</VSCodeOption>,
			)

			categorizedModels.supported.forEach((model) => {
				options.push(
					<VSCodeOption key={model.id} value={model.id} style={{ opacity: 0.6 }}>
						{model.id}
					</VSCodeOption>,
				)
			})
		}

		return options
	}

	return (
		<DropdownContainer>
			<label htmlFor="sap-ai-core-model-dropdown">
				<span style={{ fontWeight: 500 }}>Model</span>
			</label>
			<VSCodeDropdown
				id="sap-ai-core-model-dropdown"
				value={selectedModelId}
				onChange={handleModelChange}
				style={{ width: "100%" }}>
				{renderOptions()}
			</VSCodeDropdown>
		</DropdownContainer>
	)
}

export default memo(SapAiCoreModelPicker)

// Dropdown styling
const DropdownContainer = styled.div`
	position: relative;
	width: 100%;
	z-index: ${SAP_AI_CORE_MODEL_PICKER_Z_INDEX};

	// Force dropdowns to open downward
	& vscode-dropdown::part(listbox) {
		position: absolute !important;
		top: 100% !important;
		bottom: auto !important;
	}
`
