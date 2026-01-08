interface TelegramWebApp {
    initData: string;
    initDataUnsafe: any;
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
    };
    isExpanded: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    headerColor: string;
    backgroundColor: string;
    MainButton: any;
    BackButton: any;
    safeAreaInset?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };

    ready(): void;
    expand(): void;
    close(): void;
    openLink(url: string): void;
    openTelegramLink(url: string): void;
    showPopup(params: any): void;
    showAlert(message: string): void;
    showConfirm(message: string, callback?: (confirmed: boolean) => void): void;
}

interface Window {
    Telegram?: {
        WebApp: TelegramWebApp;
    };
}
