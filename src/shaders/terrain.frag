precision highp float;

// varying vec2 v2f_tex_coord;
varying vec3 v2f_position_view; // vertex position in eye (camera) coordinates
varying vec3 v2f_normal; // normal vector in camera coordinates
varying vec3 v2f_dir_to_light; // direction to light source
varying vec3 v2f_dir_from_view; // viewing vector (from eye to vertex in view coordinates)
varying float v2f_height;
varying vec3 position_in_light_view; // vertex position in light coordinates

uniform vec4 light_position; //in camera space coordinates already
uniform sampler2D shadowmap;

const vec3  light_color = vec3(1.0, 0.941, 0.898);
// Small perturbation to prevent "z-fighting" on the water on some machines...
const float terrain_water_level    = -0.03125 + 1e-6;
const vec3  terrain_color_water    = vec3(0.29, 0.51, 0.62);
const vec3  terrain_color_mountain = vec3(0.8, 0.5, 0.4);
const vec3  terrain_color_grass    = vec3(0.33, 0.43, 0.18);

void main()
{
	const vec3 ambient = 0.2 * light_color; // Ambient light intensity
	float height = v2f_height;

	/* TODO
	Compute the terrain color ("material") and shininess based on the height as
	described in the handout.

	Water:
			color = terrain_color_water
			shininess = 8.0
	Ground:
			color = interpolate between terrain_color_grass and terrain_color_mountain, weight is (height - terrain_water_level)*2
	 		shininess = 0.5
	*/
	vec3 material_color = terrain_color_grass;
	float shininess = 0.5;

	/* TODO 3.2: apply the phong lighting model
    	Implement the Phong shading model by using the passed variables and write the resulting color to `color`.
    	`material_color should be used as material parameter for ambient, diffuse and specular lighting.
    	Hints:
	*/

	/* TODO 5.1.1
	Implement your map texture evaluation routine as described in the handout.
	You will need to use your perlin_fbm routine and the terrain color constants described above.
	*/
	//float noise_val = perlin_fbm(point);
	//float noise_val = perlin_fbm(v2f_tex_coord);
	float noise_val = height;
	if(noise_val < terrain_water_level) {
		material_color = terrain_color_water;
		shininess = 8.0;
	} else {
		float weight = (height - terrain_water_level) * 2.;
    material_color = mix(terrain_color_grass, terrain_color_mountain, weight);
	}

	vec3 color = ambient * material_color;

	vec3 n = normalize(v2f_normal);
	vec3 l = normalize(v2f_dir_to_light);
	float dotNL = dot(l,n);

	vec3 r = 2.0 * dotNL * n - l;
	vec3 v = -normalize(v2f_dir_from_view);

	float dist_light_and_posn = length(v2f_dir_to_light);
	vec2 coord_to_get_shadowmap = position_in_light_view.xy;
	float dist_light_and_first_posn_in_shadow_map = texture2D(shadowmap, coord_to_get_shadowmap).r;

	//we use -l because from the light's perspective, this is basically the coordinate to find the shadow map

	if (0. ==  dist_light_and_first_posn_in_shadow_map) {
		if (dotNL > 0.0){
			color += light_color * material_color * dotNL;
			if (dot(v, r) > 0.0){
				color += light_color * material_color * pow(dot(r,v), shininess);
			}
		}
	}

	gl_FragColor = vec4(color, 1.0);

}
