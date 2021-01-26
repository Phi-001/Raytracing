const vs = `
attribute vec2 a_position;
void main() {
    gl_Position = vec4(a_position, 0, 1);
}
`;

const fs = `
#define PI 3.141592653589793238
        
precision highp float;

uniform vec2 scale;
uniform float time;
uniform vec2 mouse;

float sphereIntersect(vec3 ro, vec3 rd, vec4 sph) {
    vec3 oc = ro - sph.xyz;
    float a = dot(rd, rd);
    float b = 2.0 * dot(oc, rd);
    float c = dot(oc, oc) - sph.w * sph.w;
    float h = b * b - 4.0 * a * c;
    if (h < 0.0) return -1.0; // no intersection
    h = sqrt(h);
    return (-b - h) / (2.0 * a);
}

float planeIntersect(vec3 ro, vec3 rd, vec4 p) {
    float t = -(dot(p.xyz, ro) + p.w) / dot(p.xyz, rd);
    if (!bool(t)) return -1.0;
    return t;
}

float sphereSoftShadow(vec3 ro, vec3 rd, vec4 sph, float k) {
    vec3 oc = ro - sph.xyz;
    float b = dot(oc, rd);
    float c = dot(oc,oc) - sph.w * sph.w;
    float h = b * b - c;
    
    return (b > 0.0) ? step(-0.0001, c) : smoothstep( 0.0, 1.0, h * k / b);
}

float sphOcclusion(vec3 pos, vec3 nor, vec4 sph) {
    vec3  di = sph.xyz - pos;
    float l  = length(di);
    float nl = dot(nor, di / l);
    float h  = l / sph.w;
    float h2 = h * h;
    float k2 = 1.0 - h2 * nl * nl;

    float res = max(0.0, nl) / h2;
    if(k2 > 0.0) {
        res = clamp(0.5 * (nl * h + 1.0) / h2, 0.0, 1.0);
        res = sqrt(res * res * res);
    }
    return res;
}

vec3 camera = vec3(0.0);
float fov = 30.0 * PI / 180.0;
float canvasDepth = tan(fov / 2.0);
// light
vec3 lp1 = vec3(sin(time) * 4.0, -7.0, sin(time) * 4.0 + 4.0);
vec3 lc1 = vec3(0.6);
vec3 lk1 = vec3(1.0, 0.1, 0.01);

vec3 lp2 = vec3(cos(time) * 4.0, -5.0, cos(time) * 4.0 + 4.0);
vec3 lc2 = vec3(0.6);
vec3 lk2 = vec3(1.0, 0.1, 0.01);

vec3 amc = vec3(0.1);
// sphere
vec3 ce = vec3(0.5, 0.5, 10);
float ra = 5.0;
vec4 sph = vec4(ce, ra);
vec3 sphc = vec3(0.2, 0.2, 0.2);
vec3 ssc = vec3(1.0);
float sse = 16.0;
// plane
vec3 po = vec3(1.0, 6.0, 0.0);
vec3 no = normalize(vec3(0.0, -1.0, 0.0));
vec4 pl = vec4(no, dot(-no, po));
vec3 pc = vec3(0.2, 0.2, 0.2);
vec3 psc = vec3(1.0);
float pse = 3.0;  


void main() {
    vec3 col = vec3(0.0);
    vec2 pix = 1.0 - scale * gl_FragCoord.xy;
    vec3 rd = normalize(vec3(pix, canvasDepth) - camera);
    float t = 1e10;
    vec3 n, p, c, sc;
    float se;
    float occ = 1.0;
    float t0 = sphereIntersect(camera, rd, sph);
    
    if (t0 > 0.0) {
        t = t0;
        p = camera + t * rd;
        n = normalize(p - sph.xyz);
        occ = 0.5 + 0.5 * dot(n, pl.xyz);
        c = sphc;
        sc = ssc;
        se = sse;
    }
    
    float t1 = planeIntersect(camera, rd, pl);
    
    if (t1 > 0.0 && t1 < t) {
        t = t1;
        p = camera + t * rd;
        n = pl.xyz;
        occ = sphOcclusion(p, n, sph);
        c = pc;
        sc = psc;
        se = pse;
    }
    
    if (t < 1000.0) {
        vec3 l1, h1, i1, di1, sp1, 
                l2, h2, i2, di2, sp2;
        float d1, s1,
                d2, s2;
        l1 = lp1 - p;
        d1 = length(l1);
        l1 = normalize(l1);
        h1 = normalize(-rd + l1);
        i1 = 1.0 / (lk1.x + lk1.y * d1 * lk1.z * d1 * d1) * lc1;
        di1 = max(dot(n, l1), 0.0) * c;
        sp1 = pow(max(dot(n, h1), 0.0), se) * float(dot(n, l1) > 0.0) * sc;
        s1 = sphereSoftShadow(p, l1, sph, 2.0);
        col += (di1 + sp1) * i1 * s1;
        l2 = lp2 - p;
        d2 = length(l2);
        l2 = normalize(l2);
        h2 = normalize(-rd + l2);
        i2 = 1.0 / (lk2.x + lk2.y * d2 * lk2.z * d2 * d2) * lc2;
        di2 = max(dot(n, l2), 0.0) * c;
        sp2 = pow(max(dot(n, h2), 0.0), se) * float(dot(n, l2) > 0.0) * sc;
        s2 = sphereSoftShadow(p, l2, sph, 2.0);
        col += (di2 + sp2) * i2 * s2;
        col += c * amc * (1.0 - occ);
    }
    
    gl_FragColor = vec4(pow(col, vec3(1.0 / 2.0)), 1.0);
}
`;

let time = 0;
const fps = 60;
const rate = 1000 / fps;
const canvas = document.getElementById("output");
const glArguments = {
    preserveDrawingBuffer : true,
    failIfMajorPerformanceCaveat : false,
};
const gl = canvas.getContext("webgl", glArguments) || canvas.getContext("experimental-webgl", glArguments);
if (!gl) {
    alert("*** WebGL not supported ***");
}
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, new this.Float32Array(
    [-1, -1, 
      1, -1, 
     -1,  1, 
        
     -1,  1, 
      1, -1, 
      1,  1]
), gl.STATIC_DRAW);
const fragment = gl.createShader(gl.FRAGMENT_SHADER);
const vertex = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(fragment, fs);
gl.shaderSource(vertex, vs);
gl.compileShader(fragment);
gl.compileShader(vertex);
const program = gl.createProgram();
gl.attachShader(program, fragment);
gl.attachShader(program, vertex);
gl.linkProgram(program);
gl.useProgram(program);

function draw() {
    time += rate;
    gl.clearColor(1, 1, 0, 1); 
    gl.clear(gl.COLOR_BUFFER_BIT);
    const attribLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(attribLocation);
    gl.vertexAttribPointer(attribLocation, 2, gl.FLOAT, false, 0, 0);

    const uniformLocation1 = gl.getUniformLocation(program, "time");
    gl.uniform1f(uniformLocation1, time / 1000);

    const uniformLocation2 = gl.getUniformLocation(program, "scale");
    gl.uniform2f(uniformLocation2, 2 / gl.drawingBufferWidth, 2 / gl.drawingBufferHeight);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const loop = window.setTimeout(function() {
        window.requestAnimationFrame(draw);
        window.clearTimeout(loop);
    }, rate);
}

window.requestAnimationFrame(draw);