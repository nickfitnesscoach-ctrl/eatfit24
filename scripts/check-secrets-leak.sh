#!/bin/bash
# ================================================================================================
# EatFit24 — Secret Leak Detection Script
# ================================================================================================
# Проверяет наличие секретов в git-tracked файлах
# Использование: ./scripts/check-secrets-leak.sh
#
# Exit codes:
#   0 = no secrets found
#   1 = secrets detected (blocker)
# ================================================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔐 EatFit24 — Secret Leak Detection"
echo "==================================="
echo ""

cd "$PROJECT_ROOT"

# ================================================================================================
# Паттерны секретов для поиска
# ================================================================================================

declare -a SECRET_PATTERNS=(
    # Telegram Bot Tokens (формат: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz)
    '[0-9]{9,10}:[A-Za-z0-9_-]{35}'

    # OpenRouter API Keys (формат: sk-or-v1-...)
    'sk-or-v1-[A-Za-z0-9]{64}'

    # YooKassa Live Keys (формат: live_... в переменных)
    '(YOOKASSA_SECRET_KEY|SECRET_KEY).*live_[A-Za-z0-9_-]{40,}'

    # YooKassa Test Keys (формат: test_... в переменных, не в функциях)
    '(YOOKASSA_SECRET_KEY|SECRET_KEY).*test_[A-Za-z0-9_-]{40,}'

    # Postgres Passwords (длинные hex строки)
    'POSTGRES_PASSWORD=[A-Fa-f0-9]{32,}'

    # Django SECRET_KEY (длинные hex/base64 строки)
    'SECRET_KEY=[A-Za-z0-9+/=]{40,}'
    'DJANGO_SECRET_KEY=[A-Za-z0-9+/=]{40,}'

    # AI Proxy Secret (длинные hex строки)
    'AI_PROXY_SECRET=[A-Fa-f0-9]{32,}'
    'API_PROXY_SECRET=[A-Fa-f0-9]{32,}'
)

# ================================================================================================
# Функция: поиск секретов в git-tracked файлах
# ================================================================================================

find_secrets() {
    local pattern="$1"
    local results

    # Ищем только в git-tracked файлах
    results=$(git grep -E "$pattern" -- ':!*.md' ':!scripts/check-secrets-leak.sh' 2>/dev/null || true)

    if [ -n "$results" ]; then
        echo "$results"
        return 1
    fi

    return 0
}

# ================================================================================================
# Основная проверка
# ================================================================================================

VIOLATIONS_FOUND=0

for pattern in "${SECRET_PATTERNS[@]}"; do
    echo "🔍 Checking pattern: $pattern"

    if ! find_secrets "$pattern"; then
        VIOLATIONS_FOUND=1
    fi
done

echo ""

# ================================================================================================
# Дополнительная проверка: .env файлы в git
# ================================================================================================

echo "📂 Checking for committed .env files..."

ENV_FILES=$(git ls-files | grep -E '\.env$|\.env\..*' | grep -v '\.env\.example' || true)

if [ -n "$ENV_FILES" ]; then
    echo "❌ BLOCKER: .env files detected in git:"
    echo "$ENV_FILES"
    echo ""
    echo "Remove with:"
    echo "  git rm --cached <file>"
    echo "  git commit -m 'security: remove leaked .env file'"
    VIOLATIONS_FOUND=1
else
    echo "✅ No .env files in git"
fi

echo ""

# ================================================================================================
# Результат
# ================================================================================================

if [ $VIOLATIONS_FOUND -eq 1 ]; then
    echo "=================================="
    echo "❌ SECRET LEAK DETECTED"
    echo "=================================="
    echo ""
    echo "Secrets found in git-tracked files."
    echo ""
    echo "Actions:"
    echo "  1. Remove secrets from files"
    echo "  2. Use placeholders like <REPLACE_ME> or \${VAR} in committed files"
    echo "  3. Store real secrets ONLY in .env (never commit)"
    echo "  4. If already committed, use BFG Repo Cleaner:"
    echo "     https://rtyley.github.io/bfg-repo-cleaner/"
    echo ""
    exit 1
fi

echo "=================================="
echo "✅ NO SECRETS DETECTED"
echo "=================================="
echo ""
echo "All checks passed. Safe to commit."
echo ""

exit 0
