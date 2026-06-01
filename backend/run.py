"""启动脚本

用法:
    python run.py                  # 默认 0.0.0.0:8000
    python run.py --port 9000      # 指定端口
    python run.py --reload         # 开发模式热重载
"""
import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="AI交易大师 - 行情数据后端")
    parser.add_argument("--host", default="0.0.0.0", help="绑定地址")
    parser.add_argument("--port", type=int, default=8000, help="绑定端口")
    parser.add_argument("--reload", action="store_true", help="开发模式热重载")
    args = parser.parse_args()

    print(f"🚀 AI Trader API starting at http://{args.host}:{args.port}")
    print(f"📖 API Docs: http://{args.host}:{args.port}/docs")

    uvicorn.run(
        "main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
