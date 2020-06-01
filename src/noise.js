"use strict";


function init_noise(regl, resources) {

	// shader implementing all noise functions
	const noise_library_code = resources['shaders/noise.frag'];

	// Safari (at least older versions of it) does not support reading float buffers...
	var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

	// shared buffer to which the texture are rendered
	const noise_buffer = regl.framebuffer({
		width: 768,
		height: 768,
		colorFormat: 'rgba',
		colorType: isSafari ? 'uint8' : 'float',
		stencil: false,
		depth: false,
		mag: 'linear',
		min: 'linear',
	});

	const mesh_quad_2d = {
		position: [
			// 4 vertices with 2 coordinates each
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1],
		],
		faces: [
			[0, 1, 2], // top right
			[0, 2, 3], // bottom left
		],
	}

	const pipeline_generate_texture = regl({
		attributes: {position: mesh_quad_2d.position},
		elements: mesh_quad_2d.faces,

		uniforms: {
			viewer_position: regl.prop('viewer_position'),
			viewer_scale:    regl.prop('viewer_scale'),
		},

		vert: resources['shaders/display.vert'],
		frag: regl.prop('shader_frag'),

		framebuffer: noise_buffer,
	});

	const pipeline_draw_buffer_to_screen = regl({
		attributes: {position: mesh_quad_2d.position},
		elements: mesh_quad_2d.faces,
		uniforms: {
			buffer_to_draw: noise_buffer,
		},
		vert: resources['shaders/buffer_to_screen.vert'],
		frag: resources['shaders/buffer_to_screen.frag'],
	});

	class NoiseTexture {
		constructor(name, shader_func_name, hidden) {
			this.name = name;
			this.shader_func_name = shader_func_name;
			this.shader_frag = this.generate_frag_shader();
			this.hidden = hidden;
		}

		generate_frag_shader() {
			if(this.shader_func_name == "tex_fbm_for_water") {
				return `${noise_library_code}

			// --------------

			varying vec2 v2f_tex_coords;

			// add sim time

			void main() {
				vec3 color = ${this.shader_func_name}(v2f_tex_coords);
				gl_FragColor = vec4(color, 1.0);
			}
			`;
			}
			else {
				return `${noise_library_code}

			// --------------

			varying vec2 v2f_tex_coords;

			void main() {
				vec3 color = ${this.shader_func_name}(v2f_tex_coords);
				gl_FragColor = vec4(color, 1.0);
			}
			`;

			}
		}

		get_buffer() {
			return noise_buffer;
		}

		draw_texture_to_buffer({mouse_offset = [0, 0], zoom_factor = 1.0, width = 768, height = 768}) {
			// adjust the buffer size to the desired value
			if (noise_buffer.width != width || noise_buffer.height != height) {
				noise_buffer.resize(width, height);
			}

			regl.clear({
				framebuffer: noise_buffer,
				color: [0, 0, 0, 1],
			});

			pipeline_generate_texture({
				shader_frag: this.shader_frag,
				viewer_position: vec2.negate([0, 0], mouse_offset),
				viewer_scale: zoom_factor,
			});

			return noise_buffer;
		}

		draw_buffer_to_screen() {
			pipeline_draw_buffer_to_screen();
		}
	}

	const noise_textures = [
		new NoiseTexture('FBM_for_terrain', 'tex_fbm_for_terrain', true),
		new NoiseTexture('FBM_for_water', 'tex_fbm_for_water', true),
	];

	return noise_textures;
}






/* GLES2

// Workaround regl's incomplete api for uniforms which are arrays https://github.com/regl-project/regl/issues/373
function regl_array_uniform_workaround(uniform_name, values) {
	return Object.fromEntries(
		values.map(
			(value, array_idx) => [`${uniform_name}[${array_idx}]`, value]
		)
	)
}


// Uniforms: global data available to the shader
uniforms: Object.assign({}, {
		viewer_position: regl.prop('viewer_position'),
		viewer_scale: regl.prop('viewer_scale'),
	},
	regl_array_uniform_workaround('gradients', [
		[ 1,  1],
		[-1,  1],
		[ 1, -1],
		[-1, -1],
		[ 1,  0],
		[-1,  0],
		[ 1,  0],
		[-1,  0],
		[ 0,  1],
		[ 0, -1],
		[ 0,  1],
		[ 0, -1],
	]),
),
*/
