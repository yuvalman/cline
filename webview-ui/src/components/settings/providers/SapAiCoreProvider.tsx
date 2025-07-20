import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { DebouncedTextField } from "../common/DebouncedTextField"
import { ModelInfoView } from "../common/ModelInfoView"
import { normalizeApiConfiguration } from "../utils/providerUtils"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Mode } from "@shared/ChatSettings"
import SapAiCoreModelPicker from "../SapAiCoreModelPicker"
import { ModelsServiceClient } from "@/services/grpc-client"
import { SapAiCoreModelsRequest, SapAiCoreModelDeployment } from "@shared/proto/models"
import { useCallback, useEffect, useState } from "react"

/**
 * Props for the SapAiCoreProvider component
 */
interface SapAiCoreProviderProps {
	showModelOptions: boolean
	isPopup?: boolean
	currentMode: Mode
}

/**
 * The SAP AI Core provider configuration component
 */
export const SapAiCoreProvider = ({ showModelOptions, isPopup, currentMode }: SapAiCoreProviderProps) => {
	const { apiConfiguration } = useExtensionState()
	const { handleFieldChange, handleModeFieldChange, handleModeFieldsChange } = useApiConfigurationHandlers()

	const { selectedModelId, selectedModelInfo } = normalizeApiConfiguration(apiConfiguration, currentMode)

	// State for dynamic model fetching
	const [sapAiCoreModelDeployments, setSapAiCoreModelDeployments] = useState<SapAiCoreModelDeployment[]>([])
	const [isLoadingModels, setIsLoadingModels] = useState(false)
	const [modelError, setModelError] = useState<string | null>(null)

	// Function to fetch SAP AI Core models
	const fetchSapAiCoreModels = useCallback(async () => {
		if (
			!apiConfiguration?.sapAiCoreClientId ||
			!apiConfiguration?.sapAiCoreClientSecret ||
			!apiConfiguration?.sapAiCoreBaseUrl
		) {
			setSapAiCoreModelDeployments([])
			return
		}

		setIsLoadingModels(true)
		setModelError(null)

		try {
			const response = await ModelsServiceClient.getSapAiCoreModels(
				SapAiCoreModelsRequest.create({
					clientId: apiConfiguration.sapAiCoreClientId,
					clientSecret: apiConfiguration.sapAiCoreClientSecret,
					baseUrl: apiConfiguration.sapAiCoreBaseUrl,
					tokenUrl: apiConfiguration.sapAiCoreTokenUrl,
					resourceGroup: apiConfiguration.sapAiResourceGroup,
				}),
			)

			if (response && response.deployments) {
				setSapAiCoreModelDeployments(response.deployments)
			} else {
				setSapAiCoreModelDeployments([])
			}
		} catch (error) {
			console.error("Error fetching SAP AI Core models:", error)
			setModelError("Failed to fetch models. Please check your configuration.")
			setSapAiCoreModelDeployments([])
		} finally {
			setIsLoadingModels(false)
		}
	}, [
		apiConfiguration?.sapAiCoreClientId,
		apiConfiguration?.sapAiCoreClientSecret,
		apiConfiguration?.sapAiCoreBaseUrl,
		apiConfiguration?.sapAiCoreTokenUrl,
		apiConfiguration?.sapAiResourceGroup,
	])

	// Fetch models when configuration changes
	useEffect(() => {
		if (
			showModelOptions &&
			apiConfiguration?.sapAiCoreClientId &&
			apiConfiguration?.sapAiCoreClientSecret &&
			apiConfiguration?.sapAiCoreBaseUrl
		) {
			fetchSapAiCoreModels()
		}
	}, [showModelOptions, fetchSapAiCoreModels])

	// Handle model selection - now includes both model ID and deployment ID
	const handleModelChange = useCallback(
		(modelId: string, deploymentId: string) => {
			// Update both model ID and deployment ID atomically
			handleModeFieldsChange(
				{
					modelId: { plan: "planModeApiModelId", act: "actModeApiModelId" },
					deploymentId: { plan: "planModeSapAiCoreDeploymentId", act: "actModeSapAiCoreDeploymentId" },
				},
				{ modelId, deploymentId },
				currentMode,
			)
		},
		[handleModeFieldsChange, currentMode],
	)

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreClientId || ""}
				onChange={(value) => handleFieldChange("sapAiCoreClientId", value)}
				style={{ width: "100%" }}
				type="password"
				placeholder="Enter AI Core Client Id...">
				<span style={{ fontWeight: 500 }}>AI Core Client Id</span>
			</DebouncedTextField>
			{apiConfiguration?.sapAiCoreClientId && (
				<p style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
					Client Id is set. To change it, please re-enter the value.
				</p>
			)}

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreClientSecret ? "********" : ""}
				onChange={(value) => handleFieldChange("sapAiCoreClientSecret", value)}
				style={{ width: "100%" }}
				type="password"
				placeholder="Enter AI Core Client Secret...">
				<span style={{ fontWeight: 500 }}>AI Core Client Secret</span>
			</DebouncedTextField>
			{apiConfiguration?.sapAiCoreClientSecret && (
				<p style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
					Client Secret is set. To change it, please re-enter the value.
				</p>
			)}

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreBaseUrl || ""}
				onChange={(value) => handleFieldChange("sapAiCoreBaseUrl", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Base URL...">
				<span style={{ fontWeight: 500 }}>AI Core Base URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiCoreTokenUrl || ""}
				onChange={(value) => handleFieldChange("sapAiCoreTokenUrl", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Auth URL...">
				<span style={{ fontWeight: 500 }}>AI Core Auth URL</span>
			</DebouncedTextField>

			<DebouncedTextField
				initialValue={apiConfiguration?.sapAiResourceGroup || ""}
				onChange={(value) => handleFieldChange("sapAiResourceGroup", value)}
				style={{ width: "100%" }}
				placeholder="Enter AI Core Resource Group...">
				<span style={{ fontWeight: 500 }}>AI Core Resource Group</span>
			</DebouncedTextField>

			<p
				style={{
					fontSize: "12px",
					marginTop: "5px",
					color: "var(--vscode-descriptionForeground)",
				}}>
				These credentials are stored locally and only used to make API requests from this extension.
				<VSCodeLink
					href="https://help.sap.com/docs/sap-ai-core/sap-ai-core-service-guide/access-sap-ai-core-via-api"
					style={{ display: "inline" }}>
					You can find more information about SAP AI Core API access here.
				</VSCodeLink>
			</p>

			{showModelOptions && (
				<>
					<div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
						<span style={{ fontWeight: 500 }}>Model</span>
						{isLoadingModels ? (
							<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
								Loading models...
							</div>
						) : modelError ? (
							<div style={{ fontSize: "12px", color: "var(--vscode-errorForeground)" }}>
								{modelError}
								<button
									onClick={fetchSapAiCoreModels}
									style={{
										marginLeft: "8px",
										fontSize: "11px",
										padding: "2px 6px",
										background: "var(--vscode-button-background)",
										color: "var(--vscode-button-foreground)",
										border: "none",
										borderRadius: "2px",
										cursor: "pointer",
									}}>
									Retry
								</button>
							</div>
						) : sapAiCoreModelDeployments.length > 0 ? (
							<SapAiCoreModelPicker
								sapAiCoreModelDeployments={sapAiCoreModelDeployments}
								selectedModelId={selectedModelId || ""}
								onModelChange={handleModelChange}
								placeholder="Search and select a deployment..."
							/>
						) : (
							<div style={{ fontSize: "12px", color: "var(--vscode-descriptionForeground)" }}>
								{apiConfiguration?.sapAiCoreClientId &&
								apiConfiguration?.sapAiCoreClientSecret &&
								apiConfiguration?.sapAiCoreBaseUrl
									? "No running deployments found. Please check your SAP AI Core configuration."
									: "Please configure your SAP AI Core credentials to see available models."}
							</div>
						)}
					</div>

					<ModelInfoView selectedModelId={selectedModelId} modelInfo={selectedModelInfo} isPopup={isPopup} />
				</>
			)}
		</div>
	)
}
