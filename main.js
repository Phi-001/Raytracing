const vs = `
#version 300 es

in vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0, 1);
}
`;

const fs = `
#version 300 es

precision highp float;

#define PI 3.141592653589793238
#define Infinity 1.0 / 0.0
#define tMin 0.001
#define tMax Infinity
#define samplesPerPixel 100
#define maxDepth 10
#define randomSeed 49324217
#define LAMBERTIAN 0
#define METAL 1
#define DIELECTRIC 2

struct Ray {
    vec3 origin;
    vec3 direction;
};

struct hitRecord {
    vec3 position;
    vec3 normal;
    float t;
    bool frontFace;
    bool hit;
    vec3 attenuation;
    int material;
    float fuzz;
    float indexOfRefraction;
};

struct Sphere {
    vec3 center;
    float radius;
    int material;
    vec3 albedo;
    float fuzz;
    float indexOfRefraction;
};

out vec4 outputColor;

uniform vec2 scale;
uniform float time;

const float fov = 30.0 * PI / 180.0;
const float canvasDepth = tan(fov / 2.0);

const Sphere spheres[4] = Sphere[4](Sphere(vec3( 0.0,    0.0, -1.0),   0.5, LAMBERTIAN, vec3(0.7, 0.3, 0.3), 0.0, 0.0), 
                                    Sphere(vec3( 0.0, -100.5, -1.0), 100.0, LAMBERTIAN, vec3(0.8, 0.8, 0.0), 0.0, 0.0),
                                    Sphere(vec3(-1.0,    0.0, -1.0),   0.5, DIELECTRIC, vec3(0.8, 0.8, 0.8), 0.0, 1.5),
                                    Sphere(vec3( 1.0,    0.0, -1.0),   0.5, METAL,      vec3(0.8, 0.6, 0.2), 0.3, 0.0));

vec2 randSeed = vec2(0.0);

const int PRIME32_2 = 1883677709;
const int PRIME32_3 = 2034071983;
const int PRIME32_4 = 668265263;
const int PRIME32_5 = 374761393;

float random(vec2 seed) {
    ivec2 seedi = ivec2(seed / scale.y);
    int h32 = 0;
    
    h32 = (randomSeed + PRIME32_5) | 0;
    h32 += 8;
    
    //If you need more or fewer inputs, just copy/paste these 2 lines and change the variable name
    h32 += seedi.x * PRIME32_3;
    h32 = (h32 << 17) | (h32 >> (32 - 17)) * PRIME32_4;
    
    h32 += seedi.y * PRIME32_3;
    h32 = (h32 << 17) | (h32 >> (32 - 17)) * PRIME32_4;
    
    h32 ^= h32 >> 15;
    h32 *= PRIME32_2;
    h32 ^= h32 >> 13;
    h32 *= PRIME32_3;
    h32 ^= h32 >> 16;
    
    return float(h32) / 2147483647.0;
}

vec2 hash(vec2 p) {
    p /= 1000000.0;
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy) * 1000000.0;
}

float normalRandom(vec2 seed) {
    // return a normally distributed random value
    float v1 = random(hash(seed + vec2(23.45, 37.04)));
    float v2 = random(hash(seed + vec2(84.36, 76.34)));
    return cos(2.0 * PI * v2) * sqrt(-2.0 * log(v1));
}

vec3 randomUnitVector(vec2 seed) {
    float n1 = normalRandom(hash(seed + vec2(59.23, 69.48)));
    float n2 = normalRandom(hash(seed + vec2(39.85, 54.94)));
    float n3 = normalRandom(hash(seed + vec2(49.57, 19.38)));
    return normalize(vec3(n1, n2, n3));
}

void hitSphere(Sphere sphere, Ray ray, inout hitRecord record) {
    vec3 oc = ray.origin - sphere.center;
    float a = dot(ray.direction, ray.direction);
    float halfB = dot(oc, ray.direction);
    float c = dot(oc, oc) - sphere.radius * sphere.radius;

    float discriminant = halfB * halfB - a * c;
    if (discriminant < 0.0) return;
    float sqrtd = sqrt(discriminant);

    // Find the nearest root that lies in the acceptable range.
    float root = (-halfB - sqrtd) / a;
    if (root < tMin || tMax < root) {
        root = (-halfB + sqrtd) / a;
        if (root < tMin || tMax < root)
            return;
    }
    if (root < record.t) {
        record.t = root;
        record.position = ray.origin + ray.direction * record.t;
        vec3 outwardNormal = (record.position - sphere.center) / sphere.radius;
        record.frontFace = dot(ray.direction, outwardNormal) < 0.0;
        record.normal = record.frontFace ? outwardNormal : -outwardNormal;
        record.hit = true;
        record.material = sphere.material;
        record.attenuation = sphere.albedo;
        record.fuzz = sphere.fuzz;
        record.indexOfRefraction = sphere.indexOfRefraction;
    }
}

vec3 color(Ray ray, int depth, vec2 seed) {
    int searchDepth = 0;
    vec3 col = vec3(0.0);
    vec3 attenuation = vec3(1.0);
    for (int i = 0; i < depth; i++) {
        hitRecord record = hitRecord(vec3(0.0), vec3(0.0), Infinity, false, false, vec3(0.5), LAMBERTIAN, 0.0, 0.0);
        for (int j = 0; j < spheres.length(); j++) {
            Sphere sphere = spheres[j];
            hitSphere(sphere, ray, record);
        }
        if (record.hit) {
            vec3 scatter;
            if (record.material == LAMBERTIAN) {
                scatter = record.normal + randomUnitVector(seed);
                if (dot(scatter, scatter) < 0.001) {
                    scatter = record.normal;
                }
            } else if (record.material == METAL) {
                scatter = reflect(ray.direction, record.normal + randomUnitVector(seed) * record.fuzz);
                if (dot(scatter, record.normal) < 0.0) {
                    col = vec3(0.0);
                    break;
                }
            } else if (record.material == DIELECTRIC) {
                record.attenuation = vec3(1.0, 1.0, 1.0);
                float refractionRatio = record.frontFace ? (1.0 / record.indexOfRefraction) : record.indexOfRefraction;

                vec3 unitDirection = normalize(ray.direction);
                float cosTheta = min(dot(-unitDirection, record.normal), 1.0);
                float sinTheta = sqrt(1.0 - cosTheta * cosTheta);

                bool cannotRefract = refractionRatio * sinTheta > 1.0;
                vec3 direction;

                if (cannotRefract)
                    direction = reflect(unitDirection, record.normal);
                else
                    direction = refract(unitDirection, record.normal, refractionRatio);

                scatter = direction;
            }
            ray.direction = scatter;
            ray.origin = record.position;
            attenuation *= record.attenuation;
        } else {
            float t = 0.5 * (ray.direction.y + 1.0);
            col = mix(vec3(1.0), vec3(0.5, 0.7, 1.0), t);
            break;
        }
        seed = hash(seed.yx + vec2(30.42, 19.43));
    }
    return attenuation * col;
}

void main() {
    randSeed = gl_FragCoord.xy * 1000.0;
    vec3 col = vec3(0.0);
    for (int i = 0; i < samplesPerPixel; i++) {
        Ray ray = Ray(vec3(0.0), normalize(vec3((2.0 * gl_FragCoord.xy + vec2(random(hash(randSeed + vec2(19.43, 93.42))), random(hash(randSeed + vec2(35.48, 34.41)))) - scale) / scale.y, -1)));
        col += color(ray, maxDepth, randSeed + vec2(.2834, .1934));
        randSeed = hash(randSeed + vec2(84.72, 10.83));
    }
    col /= float(samplesPerPixel);
    outputColor = vec4(sqrt(col), 1.0);
}
`;

let time = 0;
const fps = 60;
const rate = 1000 / fps;
const canvas = document.getElementById("output");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const glArguments = {
    preserveDrawingBuffer : true,
    failIfMajorPerformanceCaveat : false,
};
const gl = canvas.getContext("webgl2", glArguments) || canvas.getContext("experimental-webgl2", glArguments);
if (!gl) {
    alert("*** WebGL not supported ***");
}
gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
var buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(
    [-1, -1, 
      1, -1, 
     -1,  1, 
        
     -1,  1, 
      1, -1, 
      1,  1]
), gl.STATIC_DRAW);
const fragment = gl.createShader(gl.FRAGMENT_SHADER);
const vertex = gl.createShader(gl.VERTEX_SHADER);
gl.shaderSource(fragment, fs.trim());
gl.shaderSource(vertex, vs.trim());
gl.compileShader(fragment);
gl.compileShader(vertex);
const program = gl.createProgram();
gl.attachShader(program, fragment);
gl.attachShader(program, vertex);
gl.linkProgram(program);
gl.useProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Link failed: ' + gl.getProgramInfoLog(program));
    console.error('vs info-log: ' + gl.getShaderInfoLog(vertex));
    console.error('fs info-log: ' + gl.getShaderInfoLog(fragment));
}

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
    gl.uniform2f(uniformLocation2, gl.drawingBufferWidth, gl.drawingBufferHeight);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const loop = window.setTimeout(function() {
        //window.requestAnimationFrame(draw);
        window.clearTimeout(loop);
    }, rate);
}

window.requestAnimationFrame(draw);