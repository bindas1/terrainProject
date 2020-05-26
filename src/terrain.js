"use strict";

class BufferData {

	constructor(regl, buffer) {
		this.width = buffer.width;
		this.height = buffer.height;
		this.data = regl.read({framebuffer: buffer});

		// this can read both float and uint8 buffers
		if (this.data instanceof Uint8Array) {
			// uint8 array is in range 0...255
			this.scale = 1./255.;
		} else {
			this.scale = 1.;
		}

	}

	get(x, y) {
		x = Math.min(Math.max(x, 0), this.width - 1);
		y = Math.min(Math.max(y, 0), this.height - 1);

		return this.data[x + y*this.width << 2] * this.scale;
	}
}

function init_terrain(regl, resources, height_map_buffer) {

	const terrain_mesh = resources.new_terrain

	const shadowmap = regl.framebuffer({
		radius:      1024,
		colorFormat: 'rgba', // GLES 2.0 doesn't support single channel textures : (
		colorType:   'float',
  })

	const pipeline_shadowmap_generation = regl({
		attributes: {
			position: terrain_mesh.vertex_positions,
		},
		// Faces, as triplets of vertex indices
		elements: terrain_mesh.faces,

		// Uniforms: global data available to the shader
		uniforms: {
			mat_mvp:        regl.prop('mat_mvp'),
			mat_model_view: regl.prop('mat_model_view'),
		},

		vert: resources.shader_shadowmap_gen_vert,
		frag: resources.shader_shadowmap_gen_frag,

		// Where the result gets written to:
		framebuffer: regl.prop('out_buffer'),
  });

	const pipeline_draw_terrain = regl({
		attributes: {
			position: terrain_mesh.vertex_positions,
		},
		uniforms: {
			mat_mvp: regl.prop('mat_mvp'),
			mat_model_view: regl.prop('mat_model_view'),
			mat_model_view_light: regl.prop('mat_model_view_light'),
			mat_normals: regl.prop('mat_normals'),
			sim_time: regl.prop('sim_time'),
			light_position: regl.prop('light_position'),
			height_map: height_map_buffer,
			shadowmap: shadowmap,
		},
		elements: terrain_mesh.faces,

		vert: resources['shaders/terrain.vert'],
		frag: resources['shaders/terrain.frag'],
	});

	const flattened_cubemap_pipeline = regl({
    attributes: {
      position: [
        [0., 0.],
        [1., 0.],
        [1., 1.],
        [0., 1.],
      ],
    },
    elements: [
      [0, 1, 2], // top right
      [0, 2, 3], // bottom left
    ],
    uniforms: {
      shadowmap_to_show: shadowmap,
      preview_rect_scale: ({viewportWidth, viewportHeight}) => {
        const aspect_ratio = viewportWidth / viewportHeight;

        const width_in_viewport_units = 0.8;
        const heigh_in_viewport_units = 0.4 * aspect_ratio;

        return [
          width_in_viewport_units,
          heigh_in_viewport_units,
        ];
      },
    },
    vert: resources.shader_vis_vert,
    frag: resources.shader_vis_frag,
  });

	const light_projection = mat4.ortho(mat4.create(), -1.0, 1.0, -1.0, 1.0, 0.1, 100)

	class TerrainActor {
		constructor() {
			this.mat_mvp = mat4.create();
			this.mat_model_view = mat4.create();
			this.mat_normals = mat3.create();
			this.mat_model_to_world = mat4.create();
		}

		render_shadowmap({light_position_world}) {
			const out_buffer = shadowmap
			// clear buffer, set distance to max
			regl.clear({
				color: [0, 0, 0, 1],
				depth: 1,
				framebuffer: out_buffer,
			});

			const mat_model_view = mat4.create();
			const look_at = mat4.lookAt(mat4.create(), light_position_world, [0,0,0], [0,1,0])
			mat4.multiply(mat_model_view, look_at, this.mat_model_to_world);
			const mat_mvp = mat4.create();
			mat4_matmul_many(mat_mvp, light_projection, mat_model_view);

			// Measure new distance map
			pipeline_shadowmap_generation({
				mat_mvp: mat_mvp,
				mat_model_view: mat_model_view,
				out_buffer: out_buffer,
			});
		}

		draw_phong_contribution({mat_projection, mat_view, light_position_cam, light_position_world, sim_time}) {
			mat4_matmul_many(this.mat_model_view, mat_view, this.mat_model_to_world);
			mat4_matmul_many(this.mat_mvp, mat_projection, this.mat_model_view);

			mat3.fromMat4(this.mat_normals, this.mat_model_view);
			mat3.transpose(this.mat_normals, this.mat_normals);
			mat3.invert(this.mat_normals, this.mat_normals);

			const look_at = mat4.lookAt(mat4.create(), light_position_world, [0,0,0], [0,1,0]);
			const mat_model_view_light = mat4.multiply(mat4.create(), look_at, this.mat_model_to_world);

			pipeline_draw_terrain({
				mat_mvp: this.mat_mvp,
				mat_model_view: this.mat_model_view,
				mat_model_view_light: mat_model_view_light,
				mat_normals: this.mat_normals,
				sim_time: sim_time,
				light_position: light_position_cam,
			});
		}

		visualize_distance_map() {
			flattened_cubemap_pipeline();
		}
	}

	return new TerrainActor();
}
