/**
 * Barrel da Biblioteca_de_Componentes.
 *
 * Reexporta os primitivos para que páginas e features consumam a biblioteca
 * por um único ponto de entrada (`@/components`), sem alcançar arquivos
 * internos de `primitives/`. Os tipos públicos de cada componente são
 * exportados em conjunto para uso em formulários e composições.
 *
 * Requirements: 6.1, 6.2.
 */

export { Button } from "./primitives/Button";
export type {
    ButtonProps,
    ButtonSize,
    ButtonVariant,
} from "./primitives/Button";

export { Input } from "./primitives/Input";
export type { InputProps } from "./primitives/Input";

export { Select } from "./primitives/Select";
export type { SelectOption, SelectProps } from "./primitives/Select";

export { Card } from "./primitives/Card";
export type { CardProps, CardVariant } from "./primitives/Card";

export { OfferLayout } from "./primitives/OfferLayout";
export type { OfferLayoutProps } from "./primitives/OfferLayout";

export { OfferCard } from "./primitives/OfferCard";
export type {
    OfferCardProps,
    OfferBenefit,
    OfferIconComponent,
} from "./primitives/OfferCard";

export { AuthCard } from "./primitives/AuthCard";
export type { AuthCardProps } from "./primitives/AuthCard";

export { StepProgress } from "./primitives/StepProgress";
export type { StepProgressProps } from "./primitives/StepProgress";

export { Logo } from "./primitives/Logo";
export type { LogoProps, LogoVariant } from "./primitives/Logo";

export { TopBar } from "./primitives/TopBar";
export type { TopBarProps } from "./primitives/TopBar";

export { BottomNav } from "./primitives/BottomNav";
export type { BottomNavItem, BottomNavProps } from "./primitives/BottomNav";

export { AppShell } from "./primitives/AppShell";
export type { AppShellProps } from "./primitives/AppShell";

export { Avatar } from "./primitives/Avatar";
export type { AvatarProps, AvatarSize } from "./primitives/Avatar";

export { ProfileHeader } from "./primitives/ProfileHeader";
export type { ProfileHeaderProps } from "./primitives/ProfileHeader";

export { ProfilePhotoEditor } from "./primitives/ProfilePhotoEditor";
export type { ProfilePhotoEditorProps } from "./primitives/ProfilePhotoEditor";

export { ProfileBanner } from "./primitives/ProfileBanner";
export type { ProfileBannerProps } from "./primitives/ProfileBanner";

export { ProfileCoverEditor } from "./primitives/ProfileCoverEditor";
export type { ProfileCoverEditorProps } from "./primitives/ProfileCoverEditor";

export { StatTile } from "./primitives/StatTile";
export type { StatTileProps } from "./primitives/StatTile";

export { MetricPill } from "./primitives/MetricPill";
export type { MetricPillProps } from "./primitives/MetricPill";

export { StatHighlight } from "./primitives/StatHighlight";
export type {
    StatHighlightProps,
    StatHighlightTone,
} from "./primitives/StatHighlight";

export { StatCard } from "./primitives/StatCard";
export type { StatCardProps, StatCardTone } from "./primitives/StatCard";

export { RatingStars } from "./primitives/RatingStars";
export type {
    RatingStarsProps,
    RatingStarsSize,
} from "./primitives/RatingStars";

export { PricingTag } from "./primitives/PricingTag";
export type {
    PricingTagProps,
    PricingTagTone,
} from "./primitives/PricingTag";

export { AttributeTile } from "./primitives/AttributeTile";
export type { AttributeTileProps } from "./primitives/AttributeTile";

export { TagChip } from "./primitives/TagChip";
export type {
    TagChipProps,
    TagChipSize,
    TagChipTone,
} from "./primitives/TagChip";

export { WeekCalendar } from "./primitives/WeekCalendar";
export type { WeekCalendarProps, WeekDay } from "./primitives/WeekCalendar";

export { EmptyState } from "./primitives/EmptyState";
export type { EmptyStateProps } from "./primitives/EmptyState";

export { SectionHeader } from "./primitives/SectionHeader";
export type { SectionHeaderProps } from "./primitives/SectionHeader";

export { SectionTitle } from "./primitives/SectionTitle";
export type { SectionTitleProps } from "./primitives/SectionTitle";

export { StatList } from "./primitives/StatList";
export type { StatListProps, StatListItem } from "./primitives/StatList";

export {
    ActivityFeed,
    ActivityFeedItem,
} from "./primitives/ActivityFeed";
export type {
    ActivityFeedProps,
    ActivityFeedItemProps,
} from "./primitives/ActivityFeed";

export { FilterChips } from "./primitives/FilterChips";
export type {
    FilterChipsOption,
    FilterChipsProps,
} from "./primitives/FilterChips";

export { IconSegmented } from "./primitives/IconSegmented";
export type {
    IconSegmentedOption,
    IconSegmentedProps,
} from "./primitives/IconSegmented";

export { UpgradeBanner } from "./primitives/UpgradeBanner";
export type { UpgradeBannerProps } from "./primitives/UpgradeBanner";

export { InfoRow } from "./primitives/InfoRow";
export type { InfoRowProps } from "./primitives/InfoRow";

export { InfoList } from "./primitives/InfoList";
export type { InfoListProps } from "./primitives/InfoList";

export { Badge } from "./primitives/Badge";
export type { BadgeProps, BadgeTone } from "./primitives/Badge";

export { RankBadge } from "./primitives/RankBadge";
export type { RankBadgeProps, RankBadgeTone } from "./primitives/RankBadge";

export { HorizontalSnap } from "./primitives/HorizontalSnap";
export type { HorizontalSnapProps } from "./primitives/HorizontalSnap";

export { SearchInput } from "./primitives/SearchInput";
export type { SearchInputProps } from "./primitives/SearchInput";

export { CityCombobox } from "./primitives/CityCombobox";
export type {
    CityComboboxProps,
    CityComboboxValue,
} from "./primitives/CityCombobox";

export { ProfileFeedCard } from "./primitives/ProfileFeedCard";
export type {
    ProfileFeedCardProps,
    ProfileFeedCardVariant,
} from "./primitives/ProfileFeedCard";

export { FeatureCard } from "./primitives/FeatureCard";
export type {
    FeatureCardProps,
    FeatureCardShape,
    FeatureCardTone,
} from "./primitives/FeatureCard";

export { StatStrip } from "./primitives/StatStrip";
export type { StatStripProps, StatStripItem } from "./primitives/StatStrip";

export { OptionCard } from "./primitives/OptionCard";
export type { OptionCardProps, OptionCardTone } from "./primitives/OptionCard";

export { LogoutButton } from "./primitives/LogoutButton";
export type { LogoutButtonProps } from "./primitives/LogoutButton";

export { LinkButton } from "./primitives/LinkButton";
export type { LinkButtonProps, LinkButtonTone } from "./primitives/LinkButton";

export { IconButton } from "./primitives/IconButton";
export type {
    IconButtonProps,
    IconButtonSize,
    IconButtonTone,
} from "./primitives/IconButton";

export { LikeButton } from "./primitives/LikeButton";
export type { LikeButtonProps, LikeButtonSize } from "./primitives/LikeButton";

export { Comment, CommentInput } from "./primitives/Comment";
export type { CommentProps, CommentInputProps } from "./primitives/Comment";

export { MediaThumbnail } from "./primitives/MediaThumbnail";
export type { MediaThumbnailProps } from "./primitives/MediaThumbnail";

export { MediaGrid } from "./primitives/MediaGrid";
export type { MediaGridProps } from "./primitives/MediaGrid";

export { Paginator } from "./primitives/Paginator";
export type { PaginatorProps } from "./primitives/Paginator";

export { LockedContent } from "./primitives/LockedContent";
export type { LockedContentProps } from "./primitives/LockedContent";

export {
    MediaCarousel,
    useMediaCarousel,
} from "./primitives/MediaCarousel";
export type { MediaCarouselProps } from "./primitives/MediaCarousel";

export type { MediaItem, MediaComment } from "./primitives/MediaTypes";

export { formatRelativeTime } from "./primitives/formatRelativeTime";

export { Modal, useModal } from "./primitives/Modal";
export type { ModalProps, ModalSize } from "./primitives/Modal";

export { ConfirmDialog } from "./primitives/ConfirmDialog";
export type {
    ConfirmDialogProps,
    ConfirmTone,
} from "./primitives/ConfirmDialog";

export { InlineAlert } from "./primitives/InlineAlert";
export type { InlineAlertProps, InlineAlertTone } from "./primitives/InlineAlert";

export { PasswordChangeModal } from "./primitives/PasswordChangeModal";
export type { PasswordChangeModalProps } from "./primitives/PasswordChangeModal";

export { MediaUpload } from "./primitives/MediaUpload";
export type {
    MediaUploadProps,
    MediaSelection,
} from "./primitives/MediaUpload";

export { MediaUploadModal } from "./primitives/MediaUploadModal";
export type {
    MediaUploadModalProps,
    MediaUploadResult,
} from "./primitives/MediaUploadModal";

export { AudioRecorder } from "./primitives/AudioRecorder";
export type {
    AudioRecorderProps,
    AudioRecording,
} from "./primitives/AudioRecorder";

export { AudioRecordModal } from "./primitives/AudioRecordModal";
export type {
    AudioRecordModalProps,
    AudioRecordResult,
} from "./primitives/AudioRecordModal";

export { AudioWavePlayer } from "./primitives/AudioWavePlayer";
export type { AudioWavePlayerProps } from "./primitives/AudioWavePlayer";

export { PageSurface } from "./primitives/PageSurface";
export type {
    PageSurfaceProps,
    PageSurfaceWidth,
    PageSurfaceVerticalAlign,
} from "./primitives/PageSurface";

export { Tabs, TabList, TabTrigger, TabPanel } from "./primitives/Tabs";
export type {
    TabsProps,
    TabListProps,
    TabTriggerProps,
    TabPanelProps,
} from "./primitives/Tabs";

export { ComboboxDropdown } from "./primitives/ComboboxDropdown";
export type { ComboboxDropdownProps } from "./primitives/ComboboxDropdown";

export { ComboboxOption } from "./primitives/ComboboxOption";
export type { ComboboxOptionProps } from "./primitives/ComboboxOption";

export { LocalidadePicker } from "./primitives/LocalidadePicker";
export type {
    LocalidadePickerProps,
    LocalidadePickerValue,
} from "./primitives/LocalidadePicker";

export { PasswordInput } from "./primitives/PasswordInput";
export type { PasswordInputProps } from "./primitives/PasswordInput";

export { Switch } from "./primitives/Switch";
export type { SwitchProps } from "./primitives/Switch";

export { ChipGroup } from "./primitives/ChipGroup";
export type { ChipGroupProps, ChipOption } from "./primitives/ChipGroup";

export { FileUpload } from "./primitives/FileUpload";
export type { FileUploadProps } from "./primitives/FileUpload";

export { AvatarUpload } from "./primitives/AvatarUpload";
export type { AvatarUploadProps } from "./primitives/AvatarUpload";

export {
    AtIcon,
    ArrowRightIcon,
    BanknoteIcon,
    CalendarIcon,
    CameraIcon,
    CashIcon,
    ChatIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
    CreditCardIcon,
    CrownIcon,
    DiamondIcon,
    EyeIcon,
    EyeOffIcon,
    FlameIcon,
    FootprintIcon,
    GlobeIcon,
    HeartIcon,
    HomeIcon,
    ImageIcon,
    LockIcon,
    MailIcon,
    MapPinIcon,
    MicIcon,
    PencilIcon,
    PhoneIcon,
    PixIcon,
    PlayCircleIcon,
    PlayIcon,
    PauseIcon,
    PlusCircleIcon,
    PlusIcon,
    RulerIcon,
    ScissorsIcon,
    SparklesIcon,
    StarIcon,
    TrashIcon,
    UserIcon,
    UsersIcon,
    WeightIcon,
    WhatsappIcon,
    XIcon,
} from "./icons";
