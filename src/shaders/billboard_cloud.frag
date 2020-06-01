precision mediump float;

uniform float sim_time;
uniform sampler2D cloud_shape_map;
uniform sampler2D cloud_noise_map;
uniform sampler2D height_map;
uniform vec3 cloud_color;

// Per-vertex outputs passed on to the fragment shader
varying vec2 v2f_tex_coord;

void main() {
    // Sliding textures to simulate the cloud moving
    // webGL screen coords are -1 ... 1 but texture sampling is in range 0 ... 1, that's why all the mod() or the sin()
    // TODO maybe not mod it but use mouse offset?
    vec2 coord1 = vec2(mod(v2f_tex_coord.x + sim_time * 0.005, 1.), mod(v2f_tex_coord.y - sim_time * 0.07, 1.));
    vec2 coord2 = vec2(mod(v2f_tex_coord.x - sim_time * 0.001, 1.), mod(v2f_tex_coord.y + sim_time * 0.008 + 0.2, 1.));
    vec4 txtNoise1 = texture2D(cloud_noise_map, coord1);
    vec4 txtNoise2 = texture2D(cloud_noise_map, coord2);

    // Moving the edge of the cloud
    vec2 new_coord = vec2(sin(v2f_tex_coord.x + sim_time * 0.01), sin(v2f_tex_coord.y + sim_time * 0.008));
    float noiseBig = texture2D(height_map, new_coord).r;
    vec2 newUv = v2f_tex_coord + noiseBig * 0.2;

    // Create the shape (mask)
    vec4 txtShape = texture2D(cloud_shape_map, newUv);

    // Alpha
    float alpha = pow((txtNoise1 + txtNoise2).r, 2.5) *  txtShape.r;

    gl_FragColor = vec4(cloud_color, alpha);
}
