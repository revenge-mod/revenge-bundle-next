import type { ComponentProps, ComponentType, FC, ReactNode } from 'react'
import type {
    ImageSourcePropType,
    ImageStyle,
    PressableProps,
    TextInputProps as RNTextInputProps,
    TextProps as RNTextProps,
    TextStyle,
    ViewProps,
    ViewStyle,
} from 'react-native'

export * from './native'
export * from './polyfills'

export namespace DiscordModules {
    export namespace Flux {
        export type DispatcherPayload = any
        export type DispatcherDependency = any

        export interface StoreChangeCallbacks {
            add(cb: () => void): void
            addConditional(cb: () => boolean): void
            listeners: Set<() => void>
            remove(cb: () => void): void
            has(cb: () => void): boolean
            hasAny(): boolean
            invokeAll(): void
        }

        export type Store<T = object> = T & {
            addChangeListener(cb: () => void): void
            removeChangeListener(cb: () => void): void
            addReactChangeListener(cb: () => void): void
            removeReactChangeListener(cb: () => void): void
            addConditionalChangeListener(cb: () => boolean): void

            callback(cb: () => void): void
            throttledCallback(): unknown

            getName(): string

            __getLocalVars?(): object

            _changeCallbacks: StoreChangeCallbacks
            _isInitialized: boolean
            _version: number
            _reactChangeCallbacks: StoreChangeCallbacks
            _dispatchToken: string
        }

        export interface Dispatcher {
            _actionHandlers: unknown
            _interceptors?: ((
                payload: DispatcherPayload,
            ) => undefined | boolean)[]
            _currentDispatchActionType: undefined | string
            _processingWaitQueue: boolean
            _subscriptions: Record<
                string,
                Set<(payload: DispatcherPayload) => void>
            >
            _waitQueue: unknown[]
            addDependencies(
                node1: DispatcherDependency,
                node2: DispatcherDependency,
            ): void
            dispatch(payload: DispatcherPayload): Promise<void>
            flushWaitQueue(): void
            isDispatching(): boolean
            register(
                name: string,
                actionHandler: Record<string, (e: DispatcherPayload) => void>,
                storeDidChange: (e: DispatcherPayload) => boolean,
            ): string
            setInterceptor(
                interceptor?: (
                    payload: DispatcherPayload,
                ) => undefined | boolean,
            ): void
            /**
             * Subscribes to an action type
             * @param actionType The action type to subscribe to
             * @param callback The callback to call when the action is dispatched
             */
            subscribe(
                actionType: string,
                callback: (payload: DispatcherPayload) => void,
            ): void
            /**
             * Unsubscribes from an action type
             * @param actionType The action type to unsubscribe from
             * @param callback The callback to remove
             */
            unsubscribe(
                actionType: string,
                callback: (payload: DispatcherPayload) => void,
            ): void
            wait(cb: () => void): void
        }
    }

    export namespace AppStartPerformance {
        export type MarkArgs = [emoji: string, log: string, delta?: number]
    }

    export interface AppStartPerformance {
        mark(...args: AppStartPerformance.MarkArgs): void
        markAndLog(
            logger: InstanceType<DiscordModules.Logger>,
            ...args: AppStartPerformance.MarkArgs
        ): void
        [index: string]: unknown
    }

    export interface Constants {
        [K: string]:
            | string
            | number
            | boolean
            | null
            | ((...args: any[]) => any)
            | Constants
    }

    /**
     * Discord's `Logger` class.
     *
     * Logs will be shown in the **Debug Logs** section in settings.
     */
    export interface Logger {
        new (
            tag: string,
        ): {
            logDangerously(...args: unknown[]): void
            log(...args: unknown[]): void
            error(...args: unknown[]): void
            warn(...args: unknown[]): void
            info(...args: unknown[]): void
            time(...args: unknown[]): void
            trace(...args: unknown[]): void
            fileOnly(...args: unknown[]): void
            verboseDangerously(...args: unknown[]): void
            verbose(...args: unknown[]): void
        }
    }

    export namespace Styles {
        export type TextType = 'heading' | 'text'
        export type BasicTextSize = 'sm' | 'md' | 'lg'
        export type BasicTextSizeWithExtraLarges = BasicTextSize | 'xl' | 'xxl'
        export type TextSize = BasicTextSizeWithExtraLarges | 'xs' | 'xxs'
        export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'
        export type TextWeightWithExtraBold = TextWeight | 'extrabold'
        export type RedesignTextCategory = 'message-preview' | 'channel-title'

        export type TextVariant =
            | `heading-${BasicTextSizeWithExtraLarges}/${TextWeightWithExtraBold}`
            | `text-${TextSize}/${TextWeight}`
            | `display-${BasicTextSize}`
            | `redesign/${RedesignTextCategory}/${TextWeight}`
            | 'redesign/heading-18/bold'
            | 'eyebrow'

        export type TextStyleSheet = Record<TextVariant, RNTextProps>
        export type CreateStylesFunction = <
            const S extends Record<string, TextStyle | ViewStyle | ImageStyle>,
        >(
            styles: S,
        ) => () => S
    }

    export namespace Actions {
        export interface AlertActionCreators {
            openAlert(key: string, alert: JSX.Element): void
            dismissAlert(key: string): void
            dismissAlerts(): void
            // TODO
            useAlertStore(): unknown
        }

        export interface ToastActionCreators {
            open(options: {
                key: string
                content?: string
                icon?: number | FC
                IconComponent?: FC
                /**
                 * The icon's color, same string format as `<Text>`'s color prop
                 */
                iconColor?: string
                containerStyle?: ViewStyle
            }): void
            close(): void
        }

        export interface ActionSheetActionCreators {
            openLazy<T extends ComponentType>(
                sheet: Promise<{ default: T }>,
                key: string,
                props: ComponentProps<T>,
            ): void
            hideActionSheet(key?: string): void
        }

        // export namespace ActionSheetActionCreators {
        //     interface SimpleActionSheetOption {
        //         icon?: number
        //         label: string
        //         isDestructive?: boolean
        //         disabled?: boolean
        //         onPress?(): void
        //     }

        //     function showSimpleActionSheet(options: {
        //         key: string
        //         header: {
        //             title: string
        //             icon?: ReactNode
        //             onClose?(): void
        //         }
        //         options: SimpleActionSheetOption[]
        //     }): void
        // }
    }

    export namespace Components {
        export interface BaseButtonProps extends PressableProps {
            disabled?: boolean
            size?: ButtonSize
            variant?:
                | 'primary'
                | 'secondary'
                | 'tertiary'
                | 'destructive'
                | 'active'
                | 'primary-overlay'
                | 'secondary-overlay'
            loading?: boolean
            grow?: boolean
            scaleAmountInPx?: number
        }

        export interface ButtonProps extends BaseButtonProps {
            icon?: number
            loading?: boolean
            iconPosition?: 'start' | 'end'
            renderIcon?(): ReactNode
            renderRightIcon?(): ReactNode
            renderShine?(): ReactNode
            renderLinearGradient?(): ReactNode
            cornerRadius?: number
            textStyle?: TextStyle
            loadingColorLight?: string
            loadingColorDark?: string
            text: string
        }

        // Buttons
        export type ButtonSize = 'sm' | 'md' | 'lg'
        export type Button = FC<ButtonProps>

        export interface IconButtonProps extends BaseButtonProps {
            icon: number
            label?: string
        }

        export type IconButton = FC<IconButtonProps>

        export interface ImageButtonProps extends BaseButtonProps {
            image: ImageSourcePropType
        }

        export type ImageButton = FC<ImageButtonProps>

        export interface StackProps extends ViewProps {
            spacing?: number
            direction?: 'vertical' | 'horizontal'
        }

        export type Stack = FC<StackProps>

        export interface CardProps extends ViewProps {
            start?: boolean
            end?: boolean
            variant?: 'primary' | 'secondary' | 'transparent'
            border?: 'faint' | 'normal' | 'strong' | 'subtle' | 'none'
            shadow?: 'none' | 'low' | 'medium' | 'high' | 'border' | 'ledge'
            children: ReactNode
        }

        export type Card = FC<CardProps>

        // Inputs
        export interface TextFieldProps {
            onChange?: (value: string) => void
            onBlur?: () => void
            onFocus?: () => void

            leadingIcon?: FC
            trailingIcon?: FC
            leadingText?: string
            trailingText?: string
            description?: string
            errorMessage?: string

            isDisabled?: boolean
            focusable?: boolean
            editable?: boolean
            status?: TextFieldStatus

            defaultValue?: string
            value?: string

            placeholder?: string
            placeholderTextColor?: string

            maxLength?: number
            multiline?: boolean

            autoFocus?: boolean
            secureTextEntry?: boolean
            returnKeyType?: RNTextInputProps['returnKeyType']
            isClearable?: boolean

            size?: TextFieldSize
            style?: ViewStyle | ViewStyle[]
        }

        export type TextFieldSize = 'sm' | 'md' | 'lg'

        export type TextFieldStatus = 'default' | 'error'

        export interface TextInputProps extends TextFieldProps {
            isRound?: boolean
            label?: string
        }

        export interface TextAreaProps
            extends Omit<TextInputProps, 'multiline'> {}

        export type TextInput = FC<TextInputProps>
        export type TextField = FC<TextFieldProps>
        export type TextArea = FC<TextAreaProps>

        export interface FormSwitchProps extends ViewProps {
            value: boolean
            onValueChange(value: boolean): void
            disabled?: boolean
        }

        export type FormSwitch = FC<FormSwitchProps>
        // TODO
        // export type FormRadio = FC
        // export type FormCheckbox = FC

        export interface ActionSheetProps {
            children: ReactNode
        }

        export type ActionSheet = FC<ActionSheetProps>

        export interface ActionSheetCloseButtonProps
            extends Pick<ComponentProps<IconButton>, 'variant' | 'onPress'> {}

        export type ActionSheetCloseButton = FC<ActionSheetCloseButtonProps>

        export type ActionSheetRow = TableRow
        export type ActionSheetRowIcon = TableRowIcon
        export type ActionSheetRowGroup = TableRowGroup
        export type ActionSheetSwitchRow = TableSwitchRow
        // TODO
        // export type ActionSheetIconHeader = FC
        // export type ActionSheetHeaderBar = FC
        // export type BottomSheetTitleHeader = FC

        export type IconSize =
            | 'extraSmall10'
            | 'extraSmall'
            | 'small'
            | 'small20'
            | 'medium'
            | 'large'
            | 'custom'
            | 'refreshSmall16'
            | 'small14'

        export type TableRowVariant = 'default' | 'danger'

        export interface TableRowProps {
            label: string
            subLabel?: string
            icon?: ReactNode
            trailing?: ReactNode
            arrow?: boolean
            onPress?: PressableProps['onPress']
            disabled?: boolean
            draggable?: boolean
            dragHandlePressableProps?: PressableProps
            labelLineClamp?: number
            subLabelLineClamp?: number
            start?: boolean
            end?: boolean
            variant?: TableRowVariant
        }

        export interface TableRow extends FC<TableRowProps> {
            Arrow: FC
            Icon: TableRowIcon
        }

        export interface TableSwitchRowProps
            extends Omit<TableRowProps, 'trailing'> {
            accessibilityHint?: string
            value: boolean
            onValueChange(value: boolean): void
        }

        export type TableSwitchRow = FC<TableSwitchRowProps>

        export interface TableRowGroupProps {
            title?: string
            description?: string
            hasIcons?: boolean
            accessibilityLabel?: string
            accessibilityRole?: string
            children: ReactNode
        }

        export type TableRowGroup = FC<TableRowGroupProps>

        export interface TableRowGroupTitleProps {
            title: string
        }

        export type TableRowGroupTitle = FC<TableRowGroupTitleProps>

        export type TableRowIconVariant =
            | 'default'
            | 'blurple'
            | 'boosting-pink'
            | 'status-online'
            | 'status-idle'
            | 'status-dnd'
            | 'status-offline'
            | 'xbox'
            | 'playstation'
            | 'danger'
            | 'secondary'
            | 'translucent'

        export interface TableRowIconProps {
            source: ImageSourcePropType
            variant?: TableRowIconVariant
        }

        export type TableRowIcon = FC<TableRowIconProps>

        export interface TableRowTrailingTextProps {
            text: string
        }

        export type TableRowTrailingText = FC<TableRowTrailingTextProps>

        export interface AlertModalProps {
            title: string
            content?: ReactNode
            extraContent?: ReactNode
            actions?: ReactNode
        }

        export type AlertModal = FC<AlertModalProps>

        export type AlertActionButton = Button

        export interface ContextMenuProps {
            title: ReactNode
            triggerOnLongPress?: boolean
            items: Array<ContextMenuItem | ContextMenuItem[]>
            align?: 'left' | 'right' | 'above' | 'below'
            children: (props: Partial<BaseButtonProps>) => ReactNode
        }

        export type ContextMenu = FC<ContextMenuProps>

        export interface ContextMenuItem {
            label: string
            IconComponent?: FC
            variant?: 'default' | 'destructive'
            action(): void
        }

        export interface TextProps extends RNTextProps {
            variant?: DiscordModules.Styles.TextVariant
            color?: string
            style?: TextStyle
            lineClamp?: number
            ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip'
            tabularNumbers?: boolean
            children?: ReactNode
        }

        export type Text = FC<TextProps>

        export interface IntlLinkProps {
            target: string
            children?: ReactNode
        }

        export type IntlLink = FC<IntlLinkProps>

        export interface SliderProps {
            step: number
            value: number
            minimumValue: number
            maximumValue: number
            onValueChange: (value: number) => void
            onSlidingStart?: () => void
            onSlidingComplete?: (value: number) => void
            startIcon?: React.ReactNode
            endIcon?: React.ReactNode
        }

        export type Slider = FC<SliderProps>

        export interface NavigatorHeaderProps {
            icon?: ReactNode
            title: string
            subtitle?: string
        }

        export type NavigatorHeader = FC<NavigatorHeaderProps>
    }

    export namespace Modules {
        export namespace Settings {
            export interface SettingListRenderer {
                SettingsList: SettingsList
            }

            export interface SettingsListProps {
                ListHeaderComponent?: ComponentType
                sections: Array<{
                    label?: string | ReactNode
                    settings: string[]
                    subLabel?: string | ReactNode
                }>
            }

            export type SettingsList = FC<SettingsListProps>

            export interface SettingsSection {
                label: string
                settings: string[]
                index?: number
            }

            interface BaseSettingsItem {
                title: () => string
                parent: string | null
                unsearchable?: boolean
                variant?: DiscordModules.Components.TableRowProps['variant']
                IconComponent?: () => ReactNode
                usePredicate?: () => boolean
                useTrailing?: () => ReactNode
                useDescription?: () => string
                useIsDisabled?: () => boolean
            }

            export interface PressableSettingsItem extends BaseSettingsItem {
                type: 'pressable'
                onPress?: () => void
            }

            export interface ToggleSettingsItem extends BaseSettingsItem {
                type: 'toggle'
                useValue: () => boolean
                onValueChange?: (value: boolean) => void
            }

            export interface RouteSettingsItem extends BaseSettingsItem {
                type: 'route'
                screen: { route: string; getComponent(): ComponentType }
            }

            export interface StaticSettingsItem extends BaseSettingsItem {
                type: 'static'
            }

            export type SettingsItem =
                | PressableSettingsItem
                | ToggleSettingsItem
                | RouteSettingsItem
                | StaticSettingsItem
        }
    }
}
