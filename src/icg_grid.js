"use strict";
/*
Draw a grid!
*/

function make_grid_pipeline(regl) {
	const {mat4} = glMatrix;

	const pipeline_quad = regl({
		// Vertex attributes
		attributes: {
			// 4 vertices with 2 coordinates each
			position: [
				[-1, -1, 0],
				[1, -1, 0],
				[1, 1, 0],
				[-1, 1, 0],
			],
		},

		// Faces, as triplets of vertex indices
		elements: [
			[0, 1, 2], // top right
			[0, 2, 3], // bottom left
		],

		vert: `
		// Vertex attributes, specified in the "attributes" entry of the pipeline
		attribute vec3 position;
		
		// Per-vertex outputs passed on to the fragment shader
		varying vec2 v2f_tex_coord;
		
		// Global variables specified in "uniforms" entry of the pipeline
		uniform mat4 mat_mvp;
		
		void main() {
			v2f_tex_coord = position.xy;
			gl_Position = mat_mvp * vec4(position, 1);
		}`,

		frag: `
		precision mediump float;
		
		varying vec2 v2f_tex_coord;
		
		void main() {
			const float w = 0.02;
			const float steps = 10.;
			const float w_half = 0.5*w;
			const vec3 grid_color = vec3(1., 0.7, 0.5);

			vec2 tc_fract = fract(v2f_tex_coord * steps + w_half);

			if (tc_fract.x < w || tc_fract.y < w) {		
				gl_FragColor = vec4(grid_color, 1.);
			} else {
				discard;
			}
		}`,


		// Uniforms: global data available to the shader
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
		},	
	});

	const mat_mvp = mat4.create();
	const mat_model_to_world = mat4.fromScaling(mat4.create(), [10, 10, 10]);
	
	// this is the function run per frame, we need to provide 
	return (mat_projection, mat_world_to_cam) => {
		mat4_matmul_many(mat_mvp, mat_projection, mat_world_to_cam, mat_model_to_world);
		pipeline_quad({
			mat_mvp: mat_mvp,
		});
	}
}