# Página de evidencia servida desde el clúster

Resultados completos de la tesis (tablas, capturas de Grafana, manifiesto y costos) en una sola página pensada para el celular. El público la abre escaneando el QR de la última slide (`assets/qrEvidencia.png` → `http://192.168.10.10:32090/`), conectado a la red WiFi del router del clúster.

## 1. Generar la página

```bash
quarto render evidencia-web/index.qmd
```

Produce `evidencia-web/index.html` (unos 7.5 MB), con imágenes, estilos y el visor 3D incrustados (`lib/model-viewer.min.js`, de Google, licencia BSD-3; Quarto lo inserta dentro del HTML). Lo único que va como archivo aparte es el modelo: `modelo/cluster.glb`, generado a partir del STL publicado en Figshare (DOI 10.6084/m9.figshare.32946149): solo el ensamblaje, con la tapa colocada sobre el cuerpo y las piezas rojas coloreadas.

## 2. Copiarla al nodo maestro

La página necesita dos cosas, que deben quedar juntas: `index.html` y la carpeta `modelo/` (carcasa en formato GLB para la vista 3D).

```bash
scp -r evidencia-web/index.html evidencia-web/modelo evidencia-web/evidencia-web.yaml cluster@192.168.10.10:/tmp/
```

```bash
ssh cluster@192.168.10.10 "sudo mkdir -p /opt/evidencia-web && sudo cp -r /tmp/index.html /tmp/modelo /opt/evidencia-web/ && sudo chmod -R a+rX /opt/evidencia-web"
```

## 3. Desplegarla en K3s

```bash
ssh cluster@192.168.10.10 "sudo kubectl apply -f /tmp/evidencia-web.yaml && sudo kubectl rollout status deployment/evidencia-web"
```

La primera vez, el nodo maestro necesita **internet** para descargar la imagen `nginx:alpine` (los trabajadores ya la tienen, el maestro no necesariamente). Hacerlo en casa, no en el aula.

## 4. Comprobar

```bash
curl -I http://192.168.10.10:32090/
```

Debe responder `200 OK`. Luego, probar desde un celular conectado al WiFi del MikroTik.

## Actualizar el contenido

Repetir los pasos 1 y 2; NGINX sirve el archivo nuevo de inmediato (no hace falta reiniciar el pod).

## Retirar el despliegue

```bash
ssh cluster@192.168.10.10 "sudo kubectl delete -f /tmp/evidencia-web.yaml"
```

## Notas

- El pod se fija al nodo maestro (`nodeSelector`) porque el HTML vive en su disco (`hostPath`). No interfiere con el despliegue `nginx-deployment` de las pruebas (puerto 32080) ni con Grafana (32300).
- Si el nombre del nodo maestro no es `master`, ajustar `kubernetes.io/hostname` en el manifiesto (`kubectl get nodes`).
- El QR apunta a una IP privada: solo funciona dentro de la red del clúster, no por datos móviles.
