export const isIOS = (): boolean => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isTelegramIOS = (window as any).Telegram?.WebApp?.platform === 'ios';
    return isTelegramIOS || isIOS;
};

export const isAndroid = (): boolean => {
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isTelegramAndroid = (window as any).Telegram?.WebApp?.platform === 'android';
    return isTelegramAndroid || isAndroid;
};
