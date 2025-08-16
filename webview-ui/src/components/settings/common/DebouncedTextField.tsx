import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useDebouncedInput } from "../utils/useDebouncedInput"

/**
 * Props for the DebouncedTextField component
 */
interface DebouncedTextFieldProps {
	// Custom props for debouncing functionality
	initialValue: string
	onChange: (value: string) => void

	// New props for blur handling with change detection
	onBlur?: (value: string, hasChanged: boolean) => void

	// Common VSCodeTextField props
	style?: React.CSSProperties
	type?: "text" | "password" | "url"
	placeholder?: string
	id?: string
	children?: React.ReactNode
	disabled?: boolean
}

/**
 * A wrapper around VSCodeTextField that automatically handles debounced input
 * to prevent excessive API calls while typing. Supports change detection and blur events.
 */
export const DebouncedTextField = ({
	initialValue,
	onChange,
	onBlur,
	children,
	type,
	...otherProps
}: DebouncedTextFieldProps) => {
	const [localValue, setLocalValue, committedValue] = useDebouncedInput(initialValue, onChange)

	const handleBlur = (e: any) => {
		if (onBlur) {
			const currentValue = e.target.value
			const normalizedCurrentValue = type === "url" ? currentValue.trim() : currentValue
			const normalizedCommittedValue = type === "url" ? committedValue.trim() : committedValue
			const hasChanged = normalizedCurrentValue !== normalizedCommittedValue
			onBlur(normalizedCurrentValue, hasChanged)
		}
	}

	return (
		<VSCodeTextField
			{...otherProps}
			type={type}
			value={localValue}
			onInput={(e: any) => {
				const value = e.target.value
				setLocalValue(type === "url" ? value.trim() : value)
			}}
			onBlur={handleBlur}>
			{children}
		</VSCodeTextField>
	)
}
