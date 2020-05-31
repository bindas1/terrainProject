attribute vec3 position;

// Vertex shader computes eye-space vertex position and normals + world-space height
varying vec3 v2f_dir_to_light; // direction to light source
varying vec3 v2f_dir_from_view; // viewing vector (from eye to vertex in view coordinates)
varying float v2f_height;
varying vec3 position_in_light_view; // vertex position in light coordinates
varying vec3 v2f_dir_from_view_not_normalized;
varying vec3 position_v3;

uniform sampler2D water_height_map;
uniform sampler2D height_map;
uniform float sim_time;
uniform mat4 mat_mvp;
uniform mat4 mat_model_view;
uniform mat4 mat_model_view_light;
uniform mat3 mat_normals; // mat3 not 4, because normals are only rotated and not translated

uniform vec4 light_position; //in camera space coordinates already
void main()
{
    //TODO maybe we should wait until after changing the position_v4.z before setting the v2f_height?
    //v2f_height = position.z;
    vec4 position_v4 = vec4(position, 1);

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
    float water_level = 0.3;

    if (position_v4.z > -0.1){
        float terrain_size = 25.; //indicates size of  terrain, so we can shrink the x,y down using this value back to values between [0,1]
        float reverse_terrain_size = 1./terrain_size;
        vec2 scaled_positions = vec2(position_v4.x*reverse_terrain_size+0.5, position_v4.y*reverse_terrain_size+0.5);
        position_v4.z = length(texture2D(height_map, scaled_positions).rgb) - 0.5;

        if(position_v4.z <= water_level) {
            // simulate little waves on water
           /* vec2 uv = vec2(position_v4.x, position_v4.y);
            const float PI = 3.1415;
            float v = 5.*PI;
            float acc = 3.;
            float amplitude = .003;
            position_v4.z = (sin((uv.x*v-time)*acc)+cos((uv.y*v-time)*acc))*amplitude*2. + water_level;*/
            float amplitude = 0.05;
            position_v4.z = length(texture2D(water_height_map, scaled_positions).rgb)*amplitude + water_level - amplitude;
        }
    }

    position_v3 = position;

    //position vertex in light coordinate
    v2f_height = position_v4.z; //update height for frag
    position_in_light_view = (mat_model_view_light * position_v4).xyz;

    vec3 vector_view_to_posn = (mat_model_view * position_v4).xyz;

    // direction view to position in cam coordinate
    v2f_dir_from_view = normalize(vector_view_to_posn);//v
    v2f_dir_from_view_not_normalized = vector_view_to_posn;

    //direction position to light source in cam coordinate
    //since light is at infinite, we only care about the direction.
    //dircetion is 000 -> light posn in world view = light posn in world view ~= light posn in camera view
    v2f_dir_to_light = light_position.rgb;

    gl_Position = mat_mvp * position_v4;
}
