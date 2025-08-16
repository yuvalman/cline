import { useState, useEffect } from "react"
import { useDebounceEffect } from "@/utils/useDebounceEffect"

/**
 * A custom hook that provides debounced input handling to prevent jumpy text inputs
 * when saving changes directly to backend on every keystroke.
 *
 * @param initialValue - The initial value for the input
 * @param onChange - Callback function to save the value (e.g., to backend)
 * @param debounceMs - Debounce delay in milliseconds (default: 100ms)
 * @returns A tuple of [currentValue, setValue, committedValue]
 */
export function useDebouncedInput<T>(
	initialValue: T,
	onChange: (value: T) => void,
	debounceMs: number = 100,
): [T, (value: T) => void, T] {
	// Local state to prevent jumpy input - initialize once
	const [localValue, setLocalValue] = useState(initialValue)
	// Track the last committed (saved) value for change detection
	const [committedValue, setCommittedValue] = useState(initialValue)

	// Update local and committed values when initialValue changes externally
	useEffect(() => {
		setLocalValue(initialValue)
		setCommittedValue(initialValue)
	}, [initialValue])

	// Debounced backend save - saves after user stops changing value
	useDebounceEffect(
		() => {
			// Only call onChange and update committed value if the value actually changed
			if (localValue !== committedValue) {
				onChange(localValue)
				setCommittedValue(localValue)
			}
		},
		debounceMs,
		[localValue],
	)

	return [localValue, setLocalValue, committedValue]
}
