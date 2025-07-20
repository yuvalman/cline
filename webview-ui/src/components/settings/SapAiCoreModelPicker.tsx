import { useExtensionState } from "@/context/ExtensionStateContext"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import React, { KeyboardEvent, memo, useEffect, useMemo, useRef, useState } from "react"
import styled from "styled-components"

export const SAP_AI_CORE_MODEL_PICKER_Z_INDEX = 1_000

export interface SapAiCoreModelPickerProps {
	sapAiCoreModels: string[]
	selectedModelId: string
	onModelChange: (modelId: string) => void
	placeholder?: string
}

const SapAiCoreModelPicker: React.FC<SapAiCoreModelPickerProps> = ({
	sapAiCoreModels,
	selectedModelId,
	onModelChange,
	placeholder = "Search and select a model...",
}) => {
	const [searchTerm, setSearchTerm] = useState("")
	const [isDropdownVisible, setIsDropdownVisible] = useState(false)
	const [selectedIndex, setSelectedIndex] = useState(-1)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const dropdownListRef = useRef<HTMLDivElement>(null)

	const handleModelChange = (newModelId: string) => {
		onModelChange(newModelId)
		setSearchTerm(newModelId)
	}

	// Initialize searchTerm with selectedModelId when component mounts or selectedModelId changes
	useEffect(() => {
		if (selectedModelId && !searchTerm) {
			setSearchTerm(selectedModelId)
		}
	}, [selectedModelId])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsDropdownVisible(false)
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
		}
	}, [])

	const modelSearchResults = useMemo(() => {
		// Always return ALL models - no filtering
		return sapAiCoreModels
	}, [sapAiCoreModels])

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!isDropdownVisible) return

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault()
				setSelectedIndex((prev) => (prev < modelSearchResults.length - 1 ? prev + 1 : prev))
				break
			case "ArrowUp":
				event.preventDefault()
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
				break
			case "Enter":
				event.preventDefault()
				if (selectedIndex >= 0 && selectedIndex < modelSearchResults.length) {
					handleModelChange(modelSearchResults[selectedIndex])
					setIsDropdownVisible(false)
				}
				break
			case "Escape":
				setIsDropdownVisible(false)
				setSelectedIndex(-1)
				break
		}
	}

	useEffect(() => {
		setSelectedIndex(-1)
		if (dropdownListRef.current) {
			dropdownListRef.current.scrollTop = 0
		}
	}, [searchTerm])

	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			})
		}
	}, [selectedIndex])

	return (
		<div style={{ width: "100%" }}>
			<DropdownWrapper ref={dropdownRef}>
				<VSCodeTextField
					id="sap-ai-core-model-search"
					placeholder={placeholder}
					value={searchTerm}
					onInput={(e) => {
						const value = (e.target as HTMLInputElement)?.value || ""
						handleModelChange(value)
						setIsDropdownVisible(true)
					}}
					onFocus={() => setIsDropdownVisible(true)}
					onKeyDown={handleKeyDown}
					style={{
						width: "100%",
						zIndex: SAP_AI_CORE_MODEL_PICKER_Z_INDEX,
						position: "relative",
					}}>
					{searchTerm && (
						<div
							className="input-icon-button codicon codicon-close"
							aria-label="Clear search"
							onClick={() => {
								handleModelChange("")
								setIsDropdownVisible(true)
							}}
							slot="end"
							style={{
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								height: "100%",
							}}
						/>
					)}
				</VSCodeTextField>
				{isDropdownVisible && modelSearchResults.length > 0 && (
					<DropdownList ref={dropdownListRef}>
						{modelSearchResults.map((item, index) => (
							<DropdownItem
								key={item}
								ref={(el) => (itemRefs.current[index] = el)}
								isSelected={index === selectedIndex}
								onMouseEnter={() => setSelectedIndex(index)}
								onClick={() => {
									handleModelChange(item)
									setIsDropdownVisible(false)
								}}>
								<span>{item}</span>
							</DropdownItem>
						))}
					</DropdownList>
				)}
			</DropdownWrapper>
		</div>
	)
}

export default memo(SapAiCoreModelPicker)

// Dropdown styling

const DropdownWrapper = styled.div`
	position: relative;
	width: 100%;
`

const DropdownList = styled.div`
	position: absolute;
	top: calc(100% - 3px);
	left: 0;
	width: calc(100% - 2px);
	max-height: 200px;
	overflow-y: auto;
	background-color: var(--vscode-dropdown-background);
	border: 1px solid var(--vscode-list-activeSelectionBackground);
	z-index: ${SAP_AI_CORE_MODEL_PICKER_Z_INDEX - 1};
	border-bottom-left-radius: 3px;
	border-bottom-right-radius: 3px;
`

const DropdownItem = styled.div<{ isSelected: boolean }>`
	padding: 5px 10px;
	cursor: pointer;
	word-break: break-all;
	white-space: normal;

	background-color: ${({ isSelected }) => (isSelected ? "var(--vscode-list-activeSelectionBackground)" : "inherit")};

	&:hover {
		background-color: var(--vscode-list-activeSelectionBackground);
	}
`
