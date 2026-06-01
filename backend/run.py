"""启动脚本

用法:
    python run.py                  # 默认 0.0.0.0:8000
    python run.py --port 9000      # 指定端口
    python run.py --reload         # 开发模式热重载

Render 部署: 自动读取 PORT 环境变量
"""
import argparse
import os
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="AI交易大师 - 行情数据后端")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址")
    parser.add_argument("--port", type=int, default=None, help="绑定端口(优先用 PORT 环境变量)")
    parser.add_argument("--reload", action="store_true", help="开发模式热重载")
    args = parser.parse_args()

    # Render 通过环境变量 PORT 动态分配端口
    port = int(os.environ.get("PORT", args.port or 8000))
    host = os.environ.get("HOST", args.host)

    print(f"🚀 AI Trader API starting at http://{host}:{port}")
    print(f"📖 API Docs: http://{host}:{port}/docs")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
