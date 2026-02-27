#!/bin/bash
# ============================================
# 跆拳道學費管理系統 - 一鍵安裝腳本
# ============================================

set -e

echo "======================================"
echo "  跆拳道學費管理系統 - 安裝腳本"
echo "======================================"
echo ""

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "[!] Node.js 未安裝，請先安裝 Node.js >= 20"
    echo "    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "    sudo apt install -y nodejs"
    exit 1
fi
NODE_VER=$(node -v)
echo "[OK] Node.js: $NODE_VER"

# 檢查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "[*] 安裝 pnpm..."
    npm install -g pnpm
fi
echo "[OK] pnpm: $(pnpm -v)"

# 檢查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "[*] 安裝 PM2..."
    npm install -g pm2
fi
echo "[OK] PM2: $(pm2 -v)"

# ============================================
# 安裝 Tesseract OCR（收據識別必需）
# ============================================
echo ""
echo "[*] 檢查 Tesseract OCR..."
if ! command -v tesseract &> /dev/null; then
    echo "[*] 安裝 Tesseract OCR 和中文語言包..."
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt install -y tesseract-ocr tesseract-ocr-chi-tra tesseract-ocr-chi-sim tesseract-ocr-eng
    elif command -v yum &> /dev/null; then
        sudo yum install -y tesseract tesseract-langpack-chi_tra tesseract-langpack-chi_sim
    elif command -v brew &> /dev/null; then
        brew install tesseract tesseract-lang
    else
        echo "[!] 無法自動安裝 Tesseract，請手動安裝："
        echo "    Ubuntu/Debian: sudo apt install tesseract-ocr tesseract-ocr-chi-tra tesseract-ocr-eng"
        echo "    CentOS/RHEL:   sudo yum install tesseract tesseract-langpack-chi_tra"
        echo "    macOS:         brew install tesseract tesseract-lang"
    fi
fi

if command -v tesseract &> /dev/null; then
    echo "[OK] Tesseract: $(tesseract --version 2>&1 | head -1)"
    # 檢查語言包
    LANGS=$(tesseract --list-langs 2>&1 | tail -n +2 | tr '\n' ' ')
    echo "[OK] 可用語言: $LANGS"
    if ! echo "$LANGS" | grep -q "chi_tra"; then
        echo "[!] 繁體中文語言包未安裝，收據識別可能不準確"
        echo "    sudo apt install tesseract-ocr-chi-tra"
    fi
else
    echo "[!] Tesseract 未安裝，收據 OCR 將無法使用"
fi

# ============================================
# MySQL 配置
# ============================================
echo ""
echo "--- MySQL 配置 ---"
read -p "MySQL Host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}
read -p "MySQL Port [3306]: " DB_PORT
DB_PORT=${DB_PORT:-3306}
read -p "MySQL User [tkd_user]: " DB_USER
DB_USER=${DB_USER:-tkd_user}
read -sp "MySQL Password: " DB_PASS
echo ""
read -p "MySQL Database [taekwondo]: " DB_NAME
DB_NAME=${DB_NAME:-taekwondo}

DATABASE_URL="mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

# ============================================
# 建立資料庫
# ============================================
echo ""
echo "[*] 檢查資料庫..."
if mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "USE $DB_NAME" 2>/dev/null; then
    echo "[OK] 資料庫 $DB_NAME 已存在"
else
    echo "[*] 建立資料庫 $DB_NAME..."
    mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    echo "[OK] 資料庫已建立"
fi

# 匯入資料
if [ -f "database/full-dump.sql" ]; then
    echo "[*] 匯入資料庫結構和資料..."
    mysql -u "$DB_USER" -p"$DB_PASS" -h "$DB_HOST" -P "$DB_PORT" "$DB_NAME" < database/full-dump.sql
    echo "[OK] 資料已匯入"
fi

# ============================================
# 配置 .env
# ============================================
echo ""
echo "[*] 建立 .env 配置..."

read -p "JWT Secret [auto-generate]: " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
fi

read -p "OpenAI API Key (銀行月結單識別用，可留空): " OPENAI_KEY
read -p "OpenAI Base URL [https://api.openai.com/v1]: " OPENAI_URL
OPENAI_URL=${OPENAI_URL:-https://api.openai.com/v1}

cat > .env << EOF
DATABASE_URL=${DATABASE_URL}
NODE_ENV=production
PORT=3000
JWT_SECRET=${JWT_SECRET}
VITE_APP_ID=production
OWNER_OPEN_ID=admin
OPENAI_API_KEY=${OPENAI_KEY}
OPENAI_BASE_URL=${OPENAI_URL}
R2_BUCKET_NAME=taekwondo-receipts
EOF

echo "[OK] .env 已建立"

# ============================================
# 安裝依賴
# ============================================
echo ""
echo "[*] 安裝 Node.js 依賴..."
pnpm install
echo "[OK] 依賴已安裝"

# ============================================
# 建置專案
# ============================================
echo ""
echo "[*] 建置專案..."
pnpm run build
echo "[OK] 建置完成"

# ============================================
# 配置 PM2
# ============================================
cat > ecosystem.config.cjs << 'PMEOF'
module.exports = {
  apps: [
    {
      name: 'taekwondo',
      script: 'node',
      args: 'dist/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
    }
  ]
}
PMEOF

# ============================================
# 啟動
# ============================================
echo ""
echo "[*] 啟動服務..."
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "======================================"
echo "  安裝完成！"
echo "======================================"
echo ""
echo "  系統網址: http://localhost:3000"
echo "  管理員登入: 用電話號碼 + 密碼"
echo ""
echo "  常用命令:"
echo "    pm2 status          # 查看服務狀態"
echo "    pm2 logs taekwondo  # 查看日誌"
echo "    pm2 restart taekwondo  # 重啟服務"
echo ""
echo "  OCR 收據識別: $(command -v tesseract &>/dev/null && echo '已啟用 (Tesseract)' || echo '未啟用 (需安裝 Tesseract)')"
echo "  銀行月結單識別: $([ -n \"$OPENAI_KEY\" ] && echo '已啟用 (LLM API)' || echo '未啟用 (需設定 OPENAI_API_KEY)')"
echo ""
