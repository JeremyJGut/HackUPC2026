# HACKUPC 2026
GitGuide ha sido desarrollado en el marco de la hackathon HackUPC 2026, celebrada entre el 24 y el 26 de abril, con una duración total de 36 horas, las cuales no se han dedicado completamente al desarrollo.
Debido a las limitaciones de tiempo propias de este tipo de eventos, el proyecto se presenta como un prototipo funcional (MVP). Esto implica que:
* Algunas funcionalidades no están completamente desarrolladas
* La cobertura de casos de uso es limitada
* Existen aspectos mejorables tanto a nivel técnico como de experiencia de usuario

---
## GitGuide
¿Nunca te ha pasado que estas trabajando en un proyecto, y cuando por fin vas a guardar los cambios, surgen conflictos con los cambios de tus compañeros? ¿O que quieras ejecutar alguna acción de Git que no sepas y acabes en un tutorial de YouTube para poder guardar tu proyecto? Justo cuando creias que habias acabado de trabajar, debes reservar 30 minutos más para guardar los cambios sin romper nada. GitGuide ha llegado para ponerle solución. 
Se trata de una herramienta diseñada para mejorar la comprensión del uso de Git. Surge de la necesidad de ofrecer mayor claridad sobre las acciones que se ejecutan en un repositorio, evitando que el usuario trabaje “a ciegas” con comandos cuyo impacto no siempre es evidente.

El proyecto propone una capa de abstracción entre el usuario y Git, proporcionando explicaciones claras antes de ejecutar cualquier operación.
La inteligéncia artificial está facilitando el acceso al desarrollo de software a muchos usuarios que no saben programar, abstrayendo el funcionamiento. Lo mismo pretende hacer GitGuide con el desarrollo colaborativo. Por ende, puede resultar muy útil para aquellos que estan empezando en el desarrollo colaborativo y quieren desentenderse del funcionamiento de Git.
### Descripción y objetivos

GitGuide permite al usuario expresar acciones relacionadas con Git de forma natural. A partir de esa entrada, el sistema:

1. Interpreta la intención del usuario  
2. Traduce dicha intención a un comando de Git  
3. Explica qué efectos tendrá ese comando  
4. Solicita confirmación antes de ejecutarlo  

De este modo, se fomenta un uso más consciente y seguro de Git, especialmente útil en contextos de aprendizaje o en situaciones donde se desea evitar errores.

El objetivo principal de GitGuide es facilitar la comprensión de Git y reducir errores derivados de un uso poco informado. Está orientado tanto a usuarios principiantes como a desarrolladores que buscan mayor control sobre las acciones que realizan en sus repositorios.

### Ejemplo de funcionamiento

Como usuario quiero que los cambios que tengo en mi repositorio local se guarden en el repositorio remoto.
Entrada del usuario (Tanto por microfono como por teclado):
> Quiero subir mis cambios al repositorio

Interpretación del sistema:
```bash
git push origin main
```

El programa le muestra visualmente al usuario el cambio que se va a ejecutar, y cuando este acepta los cambios, el programa ejecuta la instrucción mostrada.
