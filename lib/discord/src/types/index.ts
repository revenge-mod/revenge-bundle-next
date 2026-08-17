import type { StackScreenProps } from '@react-navigation/stack'
import type { ReactNavigationParamList } from '@revenge-mod/externals/react-navigation'
import type { AnyFunction, AnyObject } from '@revenge-mod/utils/types'
import type {
    ComponentProps,
    ComponentType,
    FC,
    ForwardRefExoticComponent,
    MemoExoticComponent,
    ReactElement,
    ReactNode,
    RefAttributes,
    RefObject,
} from 'react'
import type {
    ImageSourcePropType,
    ImageStyle,
    LayoutRectangle,
    NativeScrollEvent,
    PressableProps,
    TextInputProps as RNTextInputProps,
    TextProps as RNTextProps,
    ScrollView,
    ScrollViewProps,
    StyleProp,
    TextStyle,
    View,
    ViewProps,
    ViewStyle,
} from 'react-native'
import type { NativeGesture } from 'react-native-gesture-handler'
import type { AnimatedRef, SharedValue } from 'react-native-reanimated'

export * from './api'
export * from './native'
export * from './polyfills'

export namespace DiscordModules {
    export namespace Flux {
        export interface DispatcherPayload {
            type: string
            [key: PropertyKey]: any
        }
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
        markAndLog(logger: Logger, ...args: AppStartPerformance.MarkArgs): void
        [index: string]: unknown
    }

    export interface Constants {
        [K: string]: string | number | boolean | null | AnyFunction | Constants
    }

    /**
     * Discord's `Logger` class.
     *
     * Logs will be shown in the **Debug Logs** section in settings.
     */
    export declare class Logger {
        constructor(tag: string)

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
    export namespace Actions {
        export interface AlertActionCreators {
            openAlert(
                key: string,
                alert: ReactElement,
                onDismiss?: () => unknown,
                options?: { dismissable?: boolean },
            ): void
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
            openLazy<T extends ComponentType<any>>(
                sheet: Promise<{ default: T }>,
                key: string,
                props: {
                    impressionName?: string
                    impressionProperties?: AnyObject
                    backdropKind?: string
                    disableHapticOnOpen?: boolean
                    appEntryKey?: string
                } & ComponentProps<T>,
                // See ActionSheetStore reducer
                stackingBehavior?: 'replaceTopSheet' | 'replaceAll' | 'stack',
            ): void
            hideActionSheet(key?: string): void
            hideAllActionSheets(): void
            setActionSheetZIndex(zIndex: number): void
            resetActionSheetsForAppEntryKey(appEntryKey: string): void
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
        export namespace Styles {
            export type TextType = 'heading' | 'text'
            export type BasicTextSize = 'sm' | 'md' | 'lg'
            export type BasicTextSizeWithExtraLarges =
                | BasicTextSize
                | 'xl'
                | 'xxl'
            export type TextSize = BasicTextSizeWithExtraLarges | 'xs' | 'xxs'
            export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold'
            export type TextWeightWithExtraBold = TextWeight | 'extrabold'
            export type RedesignTextCategory =
                | 'message-preview'
                | 'channel-title'

            export type TextVariant =
                | `heading-${BasicTextSizeWithExtraLarges}/${TextWeightWithExtraBold}`
                | `text-${TextSize}/${TextWeight}`
                | `display-${BasicTextSize}`
                | `redesign/${RedesignTextCategory}/${TextWeight}`
                | 'redesign/heading-18/bold'
                | 'eyebrow'

            export type TextStyleSheet = Record<TextVariant, TextStyle>
            export type CreateStylesFunction = <
                const S extends Record<
                    string,
                    TextStyle | ViewStyle | ImageStyle
                >,
            >(
                styles: S,
            ) => () => S
        }

        export type UseTooltipFunction = (
            ref: RefObject<View | null>,
            props: UseTooltipFunctionProps,
        ) => unknown

        export interface UseTooltipFunctionProps {
            label: string
            position?: 'top' | 'bottom'
            visible?: boolean
            onPress?: () => void
        }

        export interface BaseButtonProps
            extends PressableProps,
                RefAttributes<View> {
            disabled?: boolean
            size?: ButtonSize
            variant?:
                | 'primary'
                | 'secondary'
                | 'tertiary'
                | 'destructive'
                | 'active'
                | 'expressive'
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

        export interface FloatingActionButtonProps {
            icon: number
            onPress: () => void
            disabled?: boolean
            positionBottom?: number
            accessibilityLabel?: string
        }

        export type FloatingActionButton = FC<FloatingActionButtonProps>

        export interface StackProps extends ViewProps {
            spacing?: number
            align?: ViewStyle['alignItems']
            justify?: ViewStyle['justifyContent']
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
            style?: StyleProp<ViewStyle>
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
            scrollable?: boolean
            startExpanded?: boolean
            /** Whether the bottom sheet handle is disabled. */
            handleDisabled?: boolean
            showGradient?: boolean

            startHeight?: number
            maxHeight?: number
            containerHeight?: number
            contentHeight?: number
            backdropOpacity?: number

            children?: ReactNode
            header?: ReactNode
            footer?: ReactNode
            extraContent?: ReactNode
            backdropChildren?: ReactNode

            handleComponent?: ComponentType<any> | null
            backgroundComponent?: ComponentType<any>

            bodyStyles?: StyleProp<ViewStyle>
            contentStyles?: StyleProp<ViewStyle>
            backgroundStyles?: StyleProp<ViewStyle>
            borderGradient?: string[] | Record<string, any>

            onExpand?: () => void
            onDismiss?: () => void
            animatedIndex?: unknown

            keyboardShouldPersistTaps?: 'always' | 'never' | 'handled' | boolean
            dismissAccessibilityLabel?: string
        }

        export type ActionSheet = ForwardRefExoticComponent<
            ActionSheetProps &
                // See useBottomSheetImperativeHandle
                RefAttributes<{
                    expandActionSheet(): void
                    closeActionSheet(force?: boolean): void
                    collapseActionSheet(): void
                    snapToIndex(index: number): void
                }>
        >

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
        export interface BottomSheetTitleHeaderProps {
            leading?: ReactNode
            title: string
            trailing?: ReactNode
        }

        export type BottomSheetTitleHeader = FC<BottomSheetTitleHeaderProps>

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

        export interface TableCheckboxRowProps
            extends Omit<TableRowProps, 'trailing'> {
            checked: boolean
            value: string
        }

        export type TableCheckboxRow = FC<TableCheckboxRowProps>

        export interface TableRadioGroupProps<T = string>
            extends TableRowGroupProps {
            children: ReactNode
            onChange: (value: T) => void
            defaultValue?: T
        }

        export interface TableRadioRowProps<T = any> extends TableRowProps {
            label: string
            value: T
        }

        export declare function TableRadioGroup<T>(
            props: TableRadioGroupProps<T>,
        ): ReactElement

        export declare function TableRadioRow<T>(
            props: TableRadioRowProps<T>,
        ): ReactElement

        export interface TableRowProps {
            label: string
            subLabel?: ReactNode
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
            Group: TableRowGroup
            TrailingText: TableRowTrailingText
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
            title?: ReactNode
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
            variant?: Styles.TextVariant
            color?: string
            style?: StyleProp<TextStyle>
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
            startIcon?: ReactNode
            endIcon?: ReactNode
        }

        export type Slider = FC<SliderProps>

        export interface NavigatorHeaderProps {
            icon?: ReactNode
            title: string
            subtitle?: string
        }

        export type NavigatorHeader = FC<NavigatorHeaderProps>

        export interface LayerScopeProps {
            children?: ReactNode
            zIndex?: number
        }

        export type LayerScope = FC<LayerScopeProps>

        export interface SegmentedControlItem {
            id: string
            label: string
            /**
             * The page to render.
             *
             * Only rendered by {@link SegmentedControlPages}.
             */
            page?: ReactNode
            /**
             * The count to render after the label, formatted by {@link TabsProps.formatCount}.
             *
             * Only rendered by {@link Tabs}.
             */
            count?: number
            /**
             * The icon to render above the label.
             *
             * Only rendered by {@link SegmentedControl} when its variant is `experimental_Large`.
             */
            icon?: ReactNode
        }

        export interface UseSegmentedControlStateFunctionProps {
            items: SegmentedControlItem[]
            /** The width of a single page. {@link SegmentedControlPages} renders nothing when this is `0`. */
            pageWidth: number
            /** @default 0 */
            defaultIndex?: number
            /**
             * The gap between items.
             *
             * @default tokens.space.PX_24
             */
            itemSpacing?: number
            /** Called once a page has fully scrolled into view. */
            onPageChange?: (index: number) => void
            /**
             * Called before {@link SegmentedControlState.setActiveIndex} changes the index.
             * The change only happens once `commit` is called.
             */
            onPageChangeStart?: (index: number, commit: () => void) => void
            /** Called when {@link SegmentedControlState.setActiveIndex} changes the index. */
            onSetActiveIndex?: (index: number) => void
        }

        export interface SegmentedControlState {
            /** The active index. Fractional while the pager is being dragged. */
            activeIndex: SharedValue<number>
            /** The range of page indices that are currently mounted and unfrozen. */
            visiblePageRange: SharedValue<[start: number, end: number]>
            /** Ref to {@link SegmentedControlPages}' scroll view. */
            pagerRef: AnimatedRef<ScrollView>
            /** The scroll offset the pager is animating to, or `-1` when it is not animating. */
            scrollTarget: SharedValue<number>
            /** How far the pager is overscrolled past its bounds. Used to squish the indicator. */
            scrollOverflow: SharedValue<number>
            /** The horizontal scroll offset of the {@link Tabs} bar. */
            scrollOffset: SharedValue<number>
            items: SegmentedControlItem[]
            /** The measured layout of every item, keyed by index. */
            itemDimensions: SharedValue<LayoutRectangle[]>
            itemSpacing: number
            pageWidth: number
            /** The index of the item currently being pressed, or `-1`. */
            pressedIndex: SharedValue<number>
            onPageChangeRef: RefObject<((index: number) => void) | undefined>
            /**
             * Scrolls to, and activates, the given index.
             *
             * @param index The index to activate.
             * @param hapticFeedback Whether to trigger haptic feedback. Defaults to `true`.
             * @param immediate Whether to skip the scroll animation. Defaults to `false`.
             */
            setActiveIndex(
                index: number,
                hapticFeedback?: boolean,
                immediate?: boolean,
            ): void
            setItemDimensions(index: number, dimensions: LayoutRectangle): void
            useReducedMotion: boolean
        }

        export type UseSegmentedControlStateFunction = (
            props: UseSegmentedControlStateFunctionProps,
        ) => SegmentedControlState

        export interface TabsProps {
            state: SegmentedControlState
            /**
             * Whether items should grow to fill the available width.
             *
             * @default true
             */
            grow?: boolean
            /**
             * Formats {@link SegmentedControlItem.count}.
             *
             * @default count => count.toLocaleString(locale)
             */
            formatCount?: (count: number) => string
            /**
             * A gesture the tab bar may be scrolled simultaneously with.
             *
             * Usually {@link SegmentedControlPagesProps.nativeGesture}, so dragging the
             * pager does not cancel the tab bar's own scroll gesture.
             */
            simultaneousHandlers?: NativeGesture
            /** Worklet called with the horizontal scroll offset of the tab bar. */
            onScrollWorklet?: (offsetX: number) => void
            /** Worklet called once the user stops dragging the tab bar. */
            onEndDrag?: () => void
            /** Use `gradient-background` to color the indicator and labels for non-flat backgrounds. */
            variant?: 'gradient-background'
        }

        export type Tabs = FC<TabsProps>

        export interface SegmentedControlPagesProps {
            state: SegmentedControlState
            style?: StyleProp<ViewStyle>
            bounces?: boolean
            /**
             * A gesture the pager may be scrolled simultaneously with.
             *
             * The pager is wrapped in a `GestureDetector` for this gesture.
             */
            nativeGesture?: NativeGesture
            /** Worklet called whenever the pager scrolls. */
            onScrollWorklet?: (event: NativeScrollEvent) => void
            /** Worklet called once the user starts dragging the pager. */
            onBeginDragWorklet?: (event: NativeScrollEvent) => void
            /** Worklet called once the user stops dragging the pager. */
            onEndDragWorklet?: (event: NativeScrollEvent) => void
        }

        export type SegmentedControlPages = FC<SegmentedControlPagesProps>

        export interface SegmentedControlProps {
            state: SegmentedControlState
            /**
             * `experimental_Large` additionally renders {@link SegmentedControlItem.icon}s,
             * doubles the spacing around the indicator, scales labels up, and lets the
             * indicator be dragged between segments.
             *
             * `experimental_Small` only shrinks the vertical padding of the segments.
             *
             * @default 'default'
             */
            variant?: 'default' | 'experimental_Small' | 'experimental_Large'
            /** Forwarded to the underlying horizontal `ScrollView`. */
            keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps']
        }

        export type SegmentedControl = FC<SegmentedControlProps>
    }

    export namespace Modules {
        export namespace Settings {
            export interface SettingListRenderer {
                SettingsList: SettingsList
                SearchableSettingsList: SearchableSettingsList
            }

            export interface SettingsListProps {
                containerStyle?: StyleProp<ViewStyle>
                initialSetting?: string
                node: {
                    type: 'list'
                    ListHeaderComponent?: ComponentType
                    ListFooterComponent?: ComponentType
                    sections: Array<{
                        label?: string | ReactNode
                        settings: string[]
                        subLabel?: string | ReactNode
                    }>
                }
            }

            export type SettingsList = MemoExoticComponent<
                FC<SettingsListProps>
            >

            // TODO: Type props properly
            export type SearchableSettingsList = MemoExoticComponent<
                FC<SettingsListProps>
            >

            export interface SettingsSection {
                label: string
                settings: string[]
                index?: number
            }

            interface BaseSettingsItem {
                useTitle: () => string
                parent: string | null
                unsearchable?: boolean
                variant?: Components.TableRowProps['variant']
                IconComponent?: () => ReactNode
                usePredicate?: () => boolean
                useTrailing?: () => ReactNode
                useDescription?: () => string
                useIsDisabled?: () => boolean
            }

            export interface PressableSettingsItem extends BaseSettingsItem {
                type: 'pressable'
                withArrow?: boolean
                onPress?: () => void
            }

            export interface ToggleSettingsItem extends BaseSettingsItem {
                type: 'toggle'
                useValue: () => boolean
                onValueChange?: (value: boolean) => void
            }

            export interface RouteSettingsItem extends BaseSettingsItem {
                type: 'route'
                screen: {
                    route: string
                    getComponent(): ComponentType<
                        StackScreenProps<ReactNavigationParamList>
                    >
                }
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

    export namespace Utils {
        export namespace TypedEventEmitter {
            export type DefaultEventMap = [never]
            export type EventMap<T> = Record<keyof T, any[]> | DefaultEventMap
            export type Listener<T, K extends keyof T> = T[K] extends any[]
                ? (...args: T[K]) => void
                : never
        }

        export declare class TypedEventEmitter<
            T extends Record<string, any[]> = Record<string, any[]>,
        > {
            addListener<K extends keyof T>(
                event: K,
                listener: TypedEventEmitter.Listener<T, K>,
            ): this
            on<K extends keyof T>(
                event: K,
                listener: TypedEventEmitter.Listener<T, K>,
            ): this
            once<K extends keyof T>(
                event: K,
                listener: TypedEventEmitter.Listener<T, K>,
            ): this
            removeListener<K extends keyof T>(
                event: K,
                listener: TypedEventEmitter.Listener<T, K>,
            ): this
            off<K extends keyof T>(
                event: K,
                listener: TypedEventEmitter.Listener<T, K>,
            ): this
            removeAllListeners(event?: keyof T): this
            emit<K extends keyof T>(event: K, ...args: T[K]): boolean
            listenerCount<K extends keyof T>(
                event: K,
                listener?: TypedEventEmitter.Listener<T, K>,
            ): number
        }
    }
}
