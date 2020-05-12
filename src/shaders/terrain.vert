attribute vec3 position;
attribute vec3 normal;

// Vertex shader computes eye-space vertex position and normals + world-space height
varying vec3 v2f_normal; // normal vector in camera coordinates
varying vec3 v2f_dir_to_light; // direction to light source
varying vec3 v2f_dir_from_view; // viewing vector (from eye to vertex in view coordinates)
varying float v2f_height;
varying vec3 v2f_dir_from_view_not_normalized;

uniform float sim_time;
uniform mat4 mat_mvp;
uniform mat4 mat_model_view;
uniform mat3 mat_normals; // mat3 not 4, because normals are only rotated and not translated

uniform vec4 light_position; //in camera space coordinates already
void main()
{
    v2f_height = position.z;
    vec4 position_v4 = vec4(position, 1);

    vec3 newNormal = normal;

    /** TODO 3.2:
    Setup all outgoing variables so that you can compute in the fragmend shader
    the phong lighting. You will need to setup all the uniforms listed above, before you
    can start coding this shader.

    Hint: Compute the vertex position, normal and light_position in eye space.
    Hint: Write the final vertex position to gl_Position
    */

    // viewing vector (from camera to vertex in view coordinates), camera is at vec3(0, 0, 0) in cam coords
    float time = sim_time*2.;
    float t = sim_time*2.;
    float water_level = -0.031;

    if(position_v4.z <= water_level) {
         // simulate little waves on water
        vec2 uv = vec2(position_v4.x, position_v4.y);
        const float PI = 3.1415;
        float v = 5.*PI;
        float acc = 3.;
        float amplitude = .03;
        position_v4.z = (sin((uv.x*v-time)*acc)+cos((uv.y*v-time)*acc))*amplitude + water_level;
        //newNormal = normalize(vec3(amplitude*(v*acc*cos((uv.x*v-time)*acc) - acc*v*sin((uv.y*v-time)*acc)), 0., 1.));
        //position_v4.z = cos(position_v4.x*5000.+t) * sin(position_v4.y * 1000.) * 0.05 - sin(position_v4.x*1000.) * sin(position_v4.y * 1600.) * 0.05;
        //newNormal = normalize(vec3(-1500.*sin(10000.*position_v4.x+t)*sin(1000.*position_v4.y) - 100. * sin(1600.*position_v4.y) * cos(1000.*position_v4.x),0., 1.));
        //position_v4 = vec4(vec3(position_v4.x, position_v4.y, 0.05 * tex_fbm_for_water(vec2(position_v4.x, position_v4.y))), position_v4.w);
        //position_v4.z = (cos(1600.0 * position_v4.x) * cos(800.0 * position_v4.y) * 0.024*5.);
        //newNormal = normalize(vec3(5.*38.4*sin(1600.*position_v4.x)*cos(800.*position_v4.y),0., 1.));
    }
    
    vec3 vector_view_to_posn = (mat_model_view * position_v4).xyz;
    
    v2f_dir_from_view_not_normalized = vector_view_to_posn;
    v2f_dir_from_view = normalize(vector_view_to_posn);//v
    // direction to light source
    v2f_dir_to_light = normalize(light_position.rgb - vector_view_to_posn);
    // transform normal to camera coordinates
    v2f_normal = normalize(mat_normals * newNormal); //n
    gl_Position = mat_mvp * position_v4;
}
