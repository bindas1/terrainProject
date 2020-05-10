precision mediump float;

varying vec3 v2f_position_view; //position in light view

void main () {
	float depth = length(v2f_position_view); //since light is at 000, then computing the length of position = dist posn -> light
	gl_FragColor.r = depth;
}
