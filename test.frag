#define MARCH_STEPS 200.0
#define MARCH_EPSILON 0.0001
#define SHADOW_STEPS 50.0
#define SHADOW_EPSILON 0.01
#define GRADIENT_STEP 0.02
#define MAX_DISTANCE 50.

float sphere( vec3 p, float s )
{
  return length(p)-s;
}

float box(vec3 p, vec3 b, float roundness)
{
  return length(max(abs(p)-(b-vec3(roundness)),0.0))-roundness;
}

float smin( float a, float b, float k )
{
  float h = clamp(0.5+0.5*(b-a)/k,0.0,1.0);
  return mix(b,a,h)-k*h*(1.0-h);
}

// ----- //
// ----- //
// ----- //

#define FOV 0.5
#define CAMERA_DISTANCE 10.

float iOvertoneVolume = 0.001;

float map(vec3 p)
{
  vec3 q = p;
  float d = sphere(p, 1.);
  q.x = q.x + 3.;
  d = min(d, sphere(q, 1.));
  q = p;
  d = min(d, -q.y+1.);
  return d;
}

// ----- //
// ----- //
// ----- //

void cameraRay(vec2 scanLines, vec3 cameraPosition, vec3 target, float fov, out vec3 pos, out vec3 dir)
{
  vec3 forward = normalize(target-cameraPosition);
  vec3 up = vec3(0.,1.,0.);
  vec3 right = normalize(cross(forward, up));
  up = normalize(cross(forward,right));

  right = right*scanLines.x*fov;
  up = up*scanLines.y*fov;

  pos = cameraPosition;
  dir = (right+up+forward);
}

float castRay( in vec3 ro, in vec3 rd )
{
  float tmin = 1.0;
  float tmax = 50.0;

  float precis = MARCH_EPSILON;
  float t = tmin;
  for( int i=0; i<int(MARCH_STEPS); i++ )
  {
    float res = map( ro+rd*t );
    if( res<precis || t>tmax ) break;
    t += res;
  }
  return t;
}

vec3 calcNormal( vec3 pos )
{
  const vec3 dx = vec3( GRADIENT_STEP, 0.0, 0.0 );
  const vec3 dy = vec3( 0.0, GRADIENT_STEP, 0.0 );
  const vec3 dz = vec3( 0.0, 0.0, GRADIENT_STEP );
  return normalize(vec3(
        map( pos + dx ) - map( pos - dx ),
        map( pos + dy ) - map( pos - dy ),
        map( pos + dz ) - map( pos - dz )
        ));
}

float calcDiffuse(vec3 normal, vec3 lightPosition)
{
  return max(dot(normal,normalize(lightPosition)),0.);
}

float calcShadows( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
  float res = 1.0;
  float t = mint;
  for( int i=0; i<int(SHADOW_STEPS); i++ )
  {
    float h = map( ro + rd*t );
    res = min( res, 8.0*h/t );
    t += clamp( h, 0.02, 0.10 );
    if( h<SHADOW_EPSILON || t>tmax ) break;
  }
  return clamp( res, 0.0, 1.0 );
}

vec2 scaleCoords(vec2 coords) {
  vec2 uv = coords.xy / iResolution.xy;
  uv = uv*2.-1.;
  uv.x = uv.x*iResolution.x/iResolution.y;
  return uv;
}

// ----- //
// ----- //
// ----- //

const vec3 HORIZON_COLOR = vec3(1., 0.7, 0.65);

float calcLight(vec3 surface, vec3 lightOrigin) {
  float diffuseLight = calcDiffuse(calcNormal(surface), lightOrigin);
  float shadow = calcShadows(surface, lightOrigin, 1., 4.25);
  float ambient = 0.02;
  float col = diffuseLight*shadow*0.7+ambient;
  return col;
}

vec3 calcLightAndReflections(vec3 surface, vec3 lightOrigin) {
  float col = 0.;
  col = calcLight(surface, lightOrigin);
  vec3 normal = calcNormal(surface);
  float distance = castRay(surface, normal);
  vec3 reflectionPoint = surface + normal*distance;
  vec3 reflection = vec3(calcLight(reflectionPoint, lightOrigin));
  reflection = max(reflection, 0.);
  if(length(distance) > MAX_DISTANCE) reflection = HORIZON_COLOR;
  return vec3(col)+vec3(reflection)*0.5;
}

// ----- //
// ----- //
// ----- //

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
  vec2 uv = scaleCoords(fragCoord.xy);
  // equvalent to the video's spec.y, I think

  vec3 camRayOrigin;
  vec3 camRayDirection;
  cameraRay(uv, vec3(sin(iTime/3.),0.,cos(iTime/3.))*CAMERA_DISTANCE,
      vec3(0.),
      FOV,
      camRayOrigin,
      camRayDirection);

  float camRayDistance = castRay(camRayOrigin, camRayDirection);
  vec3 surface = camRayOrigin + (camRayDirection*camRayDistance);

  // light 1

  vec3 col = vec3(calcLightAndReflections(surface, vec3(-1.)));

  if(camRayDistance>=50.) col = HORIZON_COLOR;

  fragColor = vec4(col,1.0);
}

