#!/usr/bin/env python3
"""
Script de setup para el agente Ollama
Verifica dependencias, instala lo necesario y prueba la configuración
"""
import subprocess
import sys
import os
import json


def print_header(text):
    """Imprime un header bonito"""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60)


def check_python_version():
    """Verifica la versión de Python"""
    print_header("Verificando Python")
    version = sys.version_info
    print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print("❌ Requiere Python 3.7 o superior")
        return False
    
    print("✓ Versión compatible")
    return True


def check_ollama():
    """Verifica que Ollama esté instalado y corriendo"""
    print_header("Verificando Ollama")
    
    # Check if ollama command exists
    try:
        result = subprocess.run(
            ["which", "ollama"],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print("❌ Ollama no está instalado")
            print("\nInstala Ollama:")
            print("  Linux/WSL: curl -fsSL https://ollama.com/install.sh | sh")
            print("  macOS: brew install ollama")
            return False
        
        print("✓ Ollama instalado")
        
    except Exception as e:
        print(f"❌ Error verificando Ollama: {e}")
        return False
    
    # Check if Ollama is running
    try:
        import requests
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        
        if response.status_code == 200:
            print("✓ Ollama está corriendo")
            
            # List available models
            models = response.json().get("models", [])
            if models:
                print(f"\n✓ Modelos disponibles ({len(models)}):")
                for model in models[:5]:  # Show first 5
                    print(f"  - {model['name']}")
            else:
                print("\n⚠️  No hay modelos descargados")
                print("Descarga un modelo: ollama pull qwen2.5:7b")
            
            return True
        else:
            print("⚠️  Ollama instalado pero no responde")
            print("Inicia Ollama: ollama serve")
            return False
            
    except Exception as e:
        print("⚠️  Ollama instalado pero no está corriendo")
        print("Inicia Ollama: ollama serve")
        return False


def install_requirements():
    """Instala dependencias de Python"""
    print_header("Instalando dependencias Python")
    
    if not os.path.exists("requirements.txt"):
        print("⚠️  requirements.txt no encontrado, creando...")
        with open("requirements.txt", "w") as f:
            f.write("requests>=2.31.0\n")
    
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
            check=True
        )
        print("✓ Dependencias instaladas")
        return True
    except subprocess.CalledProcessError:
        print("❌ Error instalando dependencias")
        return False


def download_recommended_model():
    """Pregunta si quiere descargar el modelo recomendado"""
    print_header("Modelo recomendado")
    
    print("El modelo recomendado es: qwen2.5:7b")
    print("  - Tamaño: ~4.7GB")
    print("  - Excelente para tool calling")
    print("  - Requiere ~8GB RAM")
    
    response = input("\n¿Descargar qwen2.5:7b? (s/n): ").strip().lower()
    
    if response in ['s', 'si', 'sí', 'y', 'yes']:
        print("\nDescargando modelo (esto puede tardar varios minutos)...")
        try:
            subprocess.run(
                ["ollama", "pull", "qwen2.5:7b"],
                check=True
            )
            print("✓ Modelo descargado")
            return True
        except subprocess.CalledProcessError:
            print("❌ Error descargando modelo")
            return False
    else:
        print("⏭️  Omitido. Puedes descargarlo después con: ollama pull qwen2.5:7b")
        return True


def test_agent():
    """Prueba el agente con un comando simple"""
    print_header("Probando el agente")
    
    try:
        from agent import OllamaAgent
        
        print("Ejecutando prueba simple...")
        agent = OllamaAgent(model="qwen2.5:7b")
        
        # Test básico
        response = agent.run("Echo 'Hello from agent!'", verbose=False)
        
        if response and "Hello" in response:
            print("✓ Agente funcionando correctamente")
            print(f"  Respuesta: {response[:100]}...")
            return True
        else:
            print("⚠️  Agente respondió pero la respuesta parece inusual")
            print(f"  Respuesta: {response[:200]}")
            return True
            
    except Exception as e:
        print(f"❌ Error probando el agente: {e}")
        return False


def create_test_script():
    """Crea un script de prueba simple"""
    print_header("Creando script de prueba")
    
    test_script = '''#!/usr/bin/env python3
"""Script de prueba rápido"""
from agent import OllamaAgent

# Crear agente
agent = OllamaAgent(model="qwen2.5:7b")

# Prueba simple
print("🤖 Probando agente...")
response = agent.run("Lista los archivos del directorio actual")
print(f"\\n✓ Respuesta:\\n{response}")
'''
    
    try:
        with open("test_agent.py", "w") as f:
            f.write(test_script)
        
        os.chmod("test_agent.py", 0o755)
        print("✓ Creado test_agent.py")
        print("  Ejecuta: python test_agent.py")
        return True
    except Exception as e:
        print(f"❌ Error creando script: {e}")
        return False


def main():
    """Setup principal"""
    print("""
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     🤖 SETUP - AGENTE LOCAL CON OLLAMA                  ║
║                                                          ║
║     Sistema que hace modelos pequeños poderosos         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    steps = [
        ("Verificar Python", check_python_version),
        ("Verificar Ollama", check_ollama),
        ("Instalar dependencias", install_requirements),
        ("Descargar modelo", download_recommended_model),
        ("Probar agente", test_agent),
        ("Crear script de prueba", create_test_script),
    ]
    
    results = []
    
    for step_name, step_func in steps:
        try:
            result = step_func()
            results.append((step_name, result))
            
            if not result:
                print(f"\n⚠️  {step_name} falló, pero continuando...")
        except KeyboardInterrupt:
            print("\n\n👋 Setup interrumpido")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Error en {step_name}: {e}")
            results.append((step_name, False))
    
    # Resumen final
    print_header("Resumen del Setup")
    
    success_count = sum(1 for _, result in results if result)
    total_count = len(results)
    
    for step_name, result in results:
        status = "✓" if result else "✗"
        print(f"{status} {step_name}")
    
    print(f"\n{'='*60}")
    print(f"Completado: {success_count}/{total_count} pasos exitosos")
    
    if success_count == total_count:
        print("\n🎉 ¡Todo listo! El agente está configurado.")
        print("\n📚 Siguiente paso:")
        print("  python agent.py          # Modo interactivo")
        print("  python examples.py       # Ver ejemplos")
        print("  python test_agent.py     # Prueba rápida")
    else:
        print("\n⚠️  Algunos pasos fallaron. Revisa los mensajes arriba.")
        print("Puedes continuar de todos modos o corregir los problemas.")
    
    print("\n📖 Documentación completa en README.md")
    print("="*60)


if __name__ == "__main__":
    main()
