"""
INSTALLATION SCRIPT - Run this first!
"""
import subprocess
import sys


def install_packages():
    """Install required packages"""
    packages = [
        "pyttsx3",
        "wikipedia",
        "mss"  # For screenshots
    ]

    print("Installing required packages...")
    print("-" * 50)

    for package in packages:
        try:
            subprocess.check_call([sys.executable, "-m", "pip",
                                   "install", package])
            print(f"✅ {package}")
        except subprocess.CalledProcessError:
            print(f"❌ {package} - Failed")
            print(f"   Try: pip install {package}")

    print("-" * 50)
    print("\n✅ Installation complete!")
    print("\nTo run the assistant:")
    print("  python frontend.py")
    print("\nFor voice input (when available for Python 3.13):")
    print("  pip install speechrecognition pyaudio")


if __name__ == "__main__":
    install_packages()
